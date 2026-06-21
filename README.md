/* SALDO — controle financeiro grátis. Dados ficam só no aparelho do usuário. */
(function(){
'use strict';

var CHAVE='saldo_app_v1';
var fmt=function(n){return 'R$ '+Math.round(n).toLocaleString('pt-BR');};
var hoje=function(){return new Date().toISOString().slice(0,10);};
var mesDe=function(d){return d.slice(0,7);};
var uid=function(){return Date.now()+''+Math.random().toString(36).slice(2,6);};

var meses=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
function nomeMes(ym){var p=ym.split('-');return meses[parseInt(p[1],10)-1]+'/'+p[0];}

var dados={
  lancamentos:[], orcamento:{}, recorrentes:[], metas:[],
  catEntrada:['Salário','Freelance/PJ','Investimentos','Vendas','Outros'],
  catSaida:['Moradia','Alimentação','Transporte','Saúde','Educação','Lazer','Dívidas','Outros']
};
var tipo='entrada', rTipo='entrada', chart=null, chartProj=null, abaAtual='inicio';

function carregar(){
  try{var s=localStorage.getItem(CHAVE);if(s){var d=JSON.parse(s);for(var k in d)dados[k]=d[k];}}catch(e){}
}
function salvar(){try{localStorage.setItem(CHAVE,JSON.stringify(dados));}catch(e){}}

function $(id){return document.getElementById(id);}
function el(html){var d=document.createElement('div');d.innerHTML=html;return d.firstElementChild;}

function mesesDisponiveis(){
  var s={};dados.lancamentos.forEach(function(l){s[mesDe(l.data)]=1;});
  s[new Date().toISOString().slice(0,7)]=1;
  return Object.keys(s).sort().reverse();
}
function mesAtivo(){return $('sel-mes').value||mesesDisponiveis()[0];}

function fluxoMedio(){
  var tin=0,tout=0,ms={};
  dados.lancamentos.forEach(function(l){
    if(l.tipo==='entrada')tin+=l.valor;else tout+=l.valor; ms[mesDe(l.data)]=1;
  });
  var nm=Object.keys(ms).length||1;
  return {mediaIn:tin/nm, mediaOut:tout/nm, liquido:(tin-tout)/nm};
}

var CORES=['#1d9e75','#0f3d2e','#d85a30','#534ab7','#185fa5','#ba7517','#c0392b','#5f5e5a','#639922','#993556'];

/* ---------- topo ---------- */
function renderTopo(){
  var sel=$('sel-mes'),atual=sel.value,ms=mesesDisponiveis();
  sel.innerHTML=ms.map(function(m){return '<option value="'+m+'">'+nomeMes(m)+'</option>';}).join('');
  if(atual&&ms.indexOf(atual)>=0)sel.value=atual;
  var mes=mesAtivo();
  var dm=dados.lancamentos.filter(function(l){return mesDe(l.data)===mes;});
  var ent=0,sai=0;dm.forEach(function(l){if(l.tipo==='entrada')ent+=l.valor;else sai+=l.valor;});
  $('big-in').textContent=fmt(ent);
  $('big-out').textContent=fmt(sai);
  $('big-saldo').textContent=fmt(ent-sai);
}

/* ---------- início ---------- */
function renderInicio(){
  var mes=mesAtivo();
  var dm=dados.lancamentos.filter(function(l){return mesDe(l.data)===mes;});
  var porSeg={};dm.forEach(function(l){if(l.tipo==='saida')porSeg[l.seg]=(porSeg[l.seg]||0)+l.valor;});
  var labels=Object.keys(porSeg),vals=labels.map(function(k){return porSeg[k];});
  if(chart)chart.destroy();
  var ctx=$('grafico');
  if(labels.length){
    chart=new Chart(ctx,{type:'doughnut',data:{labels:labels,datasets:[{data:vals,backgroundColor:CORES,borderWidth:0}]},
      options:{responsive:true,maintainAspectRatio:false,cutout:'62%',plugins:{legend:{display:false}}}});
    $('legenda').innerHTML=labels.map(function(l,i){
      return '<span><span class="pnt" style="background:'+CORES[i%CORES.length]+'"></span>'+l+' '+fmt(vals[i])+'</span>';
    }).join('');
  }else{
    var c=ctx.getContext('2d');c.clearRect(0,0,ctx.width,ctx.height);
    $('legenda').innerHTML='<span style="color:var(--tinta-fraca)">Sem saídas registradas neste mês</span>';
  }
  var rec=dm.slice().sort(function(a,b){return b.data<a.data?-1:1;}).slice(0,12);
  var box=$('lista-inicio');
  if(!rec.length){box.innerHTML='<div class="vazio">Nenhum lançamento neste mês.<br>Toque em <b>Lançar</b> para começar.</div>';return;}
  box.innerHTML='<div class="card">'+rec.map(function(l){
    var cor=l.tipo==='entrada'?'var(--verde-claro)':'var(--vermelho)';
    var sin=l.tipo==='entrada'?'+':'−';
    return '<div class="item"><div class="esq"><div class="desc">'+esc(l.desc)+'</div><div class="meta">'+esc(l.seg)+' · '+l.data.slice(8,10)+'/'+l.data.slice(5,7)+'</div></div>'+
      '<div class="dir"><span class="valor" style="color:'+cor+'">'+sin+fmt(l.valor)+'</span>'+
      '<button class="lixo" data-del="'+l.id+'" aria-label="Excluir">×</button></div></div>';
  }).join('')+'</div>';
  box.querySelectorAll('[data-del]').forEach(function(b){
    b.onclick=function(){dados.lancamentos=dados.lancamentos.filter(function(x){return x.id!==b.getAttribute('data-del');});salvar();renderTopo();renderInicio();};
  });
}

/* ---------- lançar ---------- */
function opcoes(lista){return lista.map(function(s){return '<option>'+esc(s)+'</option>';}).join('');}
function preencherSegs(){
  $('f-seg').innerHTML=opcoes(tipo==='entrada'?dados.catEntrada:dados.catSaida);
  $('r-seg').innerHTML=opcoes(rTipo==='entrada'?dados.catEntrada:dados.catSaida);
}
function marcarToggle(){
  $('t-in').className=tipo==='entrada'?'on-in':'';
  $('t-out').className=tipo==='saida'?'on-out':'';
}
function marcarRToggle(){
  $('rt-in').className=rTipo==='entrada'?'on-in':'';
  $('rt-out').className=rTipo==='saida'?'on-out':'';
}

/* ---------- recorrentes ---------- */
function renderRec(){
  $('r-seg').innerHTML=opcoes(rTipo==='entrada'?dados.catEntrada:dados.catSaida);
  var box=$('lista-rec');
  if(!dados.recorrentes.length){box.innerHTML='<div class="vazio">Nenhum recorrente cadastrado.</div>';return;}
  box.innerHTML='<div class="card">'+dados.recorrentes.map(function(r){
    var cor=r.tipo==='entrada'?'var(--verde-claro)':'var(--vermelho)';
    var sin=r.tipo==='entrada'?'+':'−';
    return '<div class="item"><div class="esq"><div class="desc">'+esc(r.desc)+'</div><div class="meta">'+esc(r.seg)+' · todo dia '+r.dia+'</div></div>'+
      '<div class="dir"><span class="valor" style="color:'+cor+'">'+sin+fmt(r.valor)+'</span>'+
      '<button class="lixo" data-delr="'+r.id+'" aria-label="Excluir">×</button></div></div>';
  }).join('')+'</div>';
  box.querySelectorAll('[data-delr]').forEach(function(b){
    b.onclick=function(){dados.recorrentes=dados.recorrentes.filter(function(x){return x.id!==b.getAttribute('data-delr');});salvar();renderRec();};
  });
}

/* ---------- orçamento ---------- */
function renderOrc(){
  var mes=mesAtivo();
  var gasto={};dados.lancamentos.forEach(function(l){if(mesDe(l.data)===mes&&l.tipo==='saida')gasto[l.seg]=(gasto[l.seg]||0)+l.valor;});
  var box=$('lista-orc');
  box.innerHTML='<div class="card">'+dados.catSaida.map(function(seg){
    var teto=dados.orcamento[seg]||0,g=gasto[seg]||0;
    var pct=teto>0?Math.min(100,Math.round(g/teto*100)):0;
    var estourou=teto>0&&g>teto;
    var cor=estourou?'var(--vermelho)':'var(--verde-claro)';
    return '<div class="barra-wrap"><div class="barra-topo"><span class="nome">'+esc(seg)+'</span>'+
      '<span class="nums">'+fmt(g)+' / <input type="number" min="0" step="50" value="'+(teto||'')+'" placeholder="teto" data-orc="'+esc(seg)+'"></span></div>'+
      '<div class="trilho"><div class="preenche" style="width:'+pct+'%;background:'+cor+'"></div></div></div>';
  }).join('')+'</div>';
  box.querySelectorAll('[data-orc]').forEach(function(inp){
    inp.onchange=function(){dados.orcamento[inp.getAttribute('data-orc')]=parseFloat(inp.value)||0;salvar();renderOrc();};
  });
}

/* ---------- metas ---------- */
function renderMetas(){
  var fm=fluxoMedio();
  var box=$('lista-metas');
  if(!dados.metas.length){box.innerHTML='<div class="vazio">Nenhuma meta criada ainda.</div>';return;}
  box.innerHTML=dados.metas.map(function(m){
    var pct=m.alvo>0?Math.min(100,Math.round(m.atual/m.alvo*100)):0;
    var falta=Math.max(0,m.alvo-m.atual);
    var prazo;
    if(falta<=0)prazo='✓ meta alcançada!';
    else if(fm.liquido>0)prazo='~'+Math.ceil(falta/fm.liquido)+' meses no ritmo atual';
    else prazo='fluxo médio negativo — registre mais para estimar o prazo';
    return '<div class="meta-card"><div class="cab"><span class="n">'+esc(m.nome)+'</span>'+
      '<button class="lixo" data-delm="'+m.id+'" aria-label="Excluir">×</button></div>'+
      '<div class="info"><span>'+fmt(m.atual)+' de '+fmt(m.alvo)+'</span><span>'+pct+'%</span></div>'+
      '<div class="trilho"><div class="preenche" style="width:'+pct+'%;background:var(--verde-claro)"></div></div>'+
      '<div class="prazo">'+prazo+'</div>'+
      '<div class="aporte"><input type="number" min="0" placeholder="Valor do aporte" data-ain="'+m.id+'"><button data-abtn="'+m.id+'">Aportar</button></div></div>';
  }).join('');
  box.querySelectorAll('[data-delm]').forEach(function(b){
    b.onclick=function(){dados.metas=dados.metas.filter(function(x){return x.id!==b.getAttribute('data-delm');});salvar();renderMetas();};
  });
  box.querySelectorAll('[data-abtn]').forEach(function(b){
    b.onclick=function(){
      var id=b.getAttribute('data-abtn');
      var inp=box.querySelector('[data-ain="'+id+'"]');
      var v=parseFloat(inp.value);
      if(v>0){var m=dados.metas.filter(function(x){return x.id===id;})[0];m.atual+=v;salvar();renderMetas();}
    };
  });
}

/* ---------- projeção ---------- */
function renderProj(){
  var n=parseInt($('proj-meses').value,10);
  var fm=fluxoMedio(),fluxo=fm.liquido;
  var labels=[],vals=[],acc=0,base=new Date();
  for(var i=1;i<=n;i++){var d=new Date(base.getFullYear(),base.getMonth()+i,1);labels.push(nomeMes(d.toISOString().slice(0,7)));acc+=fluxo;vals.push(Math.round(acc));}
  if(chartProj)chartProj.destroy();
  chartProj=new Chart($('grafico-proj'),{type:'line',data:{labels:labels,datasets:[{data:vals,
    borderColor:fluxo>=0?'#1d9e75':'#c0392b',backgroundColor:fluxo>=0?'rgba(29,158,117,.1)':'rgba(192,57,43,.1)',fill:true,tension:.2,pointRadius:1.5,borderWidth:2}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},
      scales:{y:{ticks:{callback:function(v){return 'R$ '+v.toLocaleString('pt-BR');}}}}}});
  $('proj-resumo').innerHTML=
    '<div class="c"><div class="l">Entrada média</div><div class="v" style="color:var(--verde-claro)">'+fmt(fm.mediaIn)+'</div></div>'+
    '<div class="c"><div class="l">Saída média</div><div class="v" style="color:var(--vermelho)">'+fmt(fm.mediaOut)+'</div></div>'+
    '<div class="c"><div class="l">Fluxo líquido</div><div class="v" style="color:'+(fluxo>=0?'var(--verde-claro)':'var(--vermelho)')+'">'+(fluxo>=0?'+':'−')+fmt(Math.abs(fluxo))+'</div></div>';
}

/* ---------- categorias ---------- */
function renderCats(){
  function mk(lista,attr){return lista.map(function(c){
    return '<div class="cat-item"><span>'+esc(c)+'</span><button data-'+attr+'="'+esc(c)+'" aria-label="Remover">×</button></div>';
  }).join('');}
  $('cat-in-lista').innerHTML=mk(dados.catEntrada,'rmin');
  $('cat-out-lista').innerHTML=mk(dados.catSaida,'rmout');
  $('cat-in-lista').querySelectorAll('[data-rmin]').forEach(function(b){
    b.onclick=function(){var c=b.getAttribute('data-rmin');dados.catEntrada=dados.catEntrada.filter(function(x){return x!==c;});salvar();renderCats();preencherSegs();};
  });
  $('cat-out-lista').querySelectorAll('[data-rmout]').forEach(function(b){
    b.onclick=function(){var c=b.getAttribute('data-rmout');dados.catSaida=dados.catSaida.filter(function(x){return x!==c;});salvar();renderCats();preencherSegs();};
  });
}

/* ---------- exportar / importar ---------- */
function baixar(nome,conteudo,tipo){
  var blob=new Blob([conteudo],{type:tipo});
  var a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=nome;a.click();
  setTimeout(function(){URL.revokeObjectURL(a.href);},1000);
}
function exportarBackup(){baixar('saldo-backup-'+hoje()+'.json',JSON.stringify(dados),'application/json');flashIO('Backup exportado!');}
function exportarCSV(){
  var head=['Tipo','Descrição','Segmento','Valor','Data'];
  var linhas=dados.lancamentos.map(function(l){return [l.tipo,l.desc,l.seg,l.valor.toFixed(2).replace('.',','),l.data];});
  var csv='\ufeff'+[head].concat(linhas).map(function(r){return r.map(function(c){return '"'+String(c).replace(/"/g,'""')+'"';}).join(';');}).join('\n');
  baixar('saldo-financas-'+hoje()+'.csv',csv,'text/csv;charset=utf-8;');flashIO('Planilha exportada!');
}
function flashIO(t,erro){var m=$('msg-io');m.textContent=t;m.className='msg '+(erro?'erro':'ok');setTimeout(function(){m.textContent='';},2500);}

/* ---------- navegação ---------- */
var VIEWS={inicio:'v-inicio',lancar:'v-lancar',rec:'v-rec',orc:'v-orc',metas:'v-metas',proj:'v-proj',mais:'v-mais'};
function irPara(aba){
  abaAtual=aba;
  for(var k in VIEWS){$(VIEWS[k]).classList.toggle('oculto',k!==aba);}
  document.querySelectorAll('nav button').forEach(function(b){b.classList.toggle('ativo',b.getAttribute('data-aba')===aba);});
  $('rotulo-mes').textContent=aba==='inicio'?'Saldo do mês':'Saldo do mês';
  if(aba==='inicio')renderInicio();
  if(aba==='rec')renderRec();
  if(aba==='orc')renderOrc();
  if(aba==='metas')renderMetas();
  if(aba==='proj')renderProj();
  if(aba==='mais')renderCats();
  window.scrollTo(0,0);
}

function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];});}

/* ---------- init ---------- */
function init(){
  carregar();
  $('f-data').value=hoje();
  preencherSegs();marcarToggle();marcarRToggle();

  document.querySelectorAll('nav button').forEach(function(b){
    b.onclick=function(){irPara(b.getAttribute('data-aba'));};
  });
  $('sel-mes').onchange=function(){renderTopo();if(abaAtual==='inicio')renderInicio();if(abaAtual==='orc')renderOrc();};

  $('t-in').onclick=function(){tipo='entrada';marcarToggle();preencherSegs();};
  $('t-out').onclick=function(){tipo='saida';marcarToggle();preencherSegs();};
  $('rt-in').onclick=function(){rTipo='entrada';marcarRToggle();renderRec();};
  $('rt-out').onclick=function(){rTipo='saida';marcarRToggle();renderRec();};

  $('b-lancar').onclick=function(){
    var desc=$('f-desc').value.trim(),valor=parseFloat($('f-valor').value),data=$('f-data').value,seg=$('f-seg').value;
    var m=$('msg-lancar');
    if(!desc||!valor||valor<=0||!data){m.textContent='Preencha descrição, valor e data.';m.className='msg erro';return;}
    dados.lancamentos.push({id:uid(),tipo:tipo,desc:desc,valor:valor,data:data,seg:seg});
    salvar();renderTopo();
    m.textContent='Lançamento adicionado!';m.className='msg ok';
    $('f-desc').value='';$('f-valor').value='';
    setTimeout(function(){m.textContent='';},2000);
  };

  $('b-add-rec').onclick=function(){
    var desc=$('r-desc').value.trim(),valor=parseFloat($('r-valor').value),dia=parseInt($('r-dia').value,10),seg=$('r-seg').value;
    var m=$('msg-rec');
    if(!desc||!valor||valor<=0||!dia){m.textContent='Preencha descrição, valor e dia.';m.className='msg erro';return;}
    dados.recorrentes.push({id:uid(),tipo:rTipo,desc:desc,valor:valor,dia:dia,seg:seg});
    salvar();renderRec();
    m.textContent='Recorrente cadastrado!';m.className='msg ok';
    $('r-desc').value='';$('r-valor').value='';$('r-dia').value='';
    setTimeout(function(){m.textContent='';},2000);
  };
  $('b-gerar').onclick=function(){
    var mes=mesAtivo(),m=$('msg-rec'),n=0;
    dados.recorrentes.forEach(function(r){
      var dia=Math.min(r.dia,28);var data=mes+'-'+(dia<10?'0'+dia:dia);
      var existe=dados.lancamentos.some(function(l){return l.data===data&&l.desc===r.desc&&l.valor===r.valor;});
      if(!existe){dados.lancamentos.push({id:uid(),tipo:r.tipo,desc:r.desc,valor:r.valor,data:data,seg:r.seg});n++;}
    });
    salvar();renderTopo();
    m.textContent=n+' lançamento(s) gerado(s) em '+nomeMes(mes)+'.';m.className='msg ok';
    setTimeout(function(){m.textContent='';},3000);
  };

  $('b-meta').onclick=function(){
    var nome=$('meta-nome').value.trim(),alvo=parseFloat($('meta-alvo').value);
    if(!nome||!alvo||alvo<=0)return;
    dados.metas.push({id:uid(),nome:nome,alvo:alvo,atual:0});
    salvar();$('meta-nome').value='';$('meta-alvo').value='';renderMetas();
  };

  $('cat-in-add').onclick=function(){var v=$('cat-in-nova').value.trim();if(v&&dados.catEntrada.indexOf(v)<0){dados.catEntrada.push(v);salvar();$('cat-in-nova').value='';renderCats();preencherSegs();}};
  $('cat-out-add').onclick=function(){var v=$('cat-out-nova').value.trim();if(v&&dados.catSaida.indexOf(v)<0){dados.catSaida.push(v);salvar();$('cat-out-nova').value='';renderCats();preencherSegs();}};

  $('proj-meses').oninput=function(){$('proj-meses-out').textContent=this.value;renderProj();};

  $('b-export').onclick=exportarBackup;
  $('b-csv').onclick=exportarCSV;
  $('b-import').onclick=function(){$('file-import').click();};
  $('file-import').onchange=function(e){
    var f=e.target.files[0];if(!f)return;
    var r=new FileReader();
    r.onload=function(){
      try{
        var d=JSON.parse(r.result);
        if(!d.lancamentos){flashIO('Arquivo inválido.',true);return;}
        for(var k in d)dados[k]=d[k];
        salvar();preencherSegs();renderTopo();irPara('inicio');flashIO('Backup importado!');
      }catch(err){flashIO('Não foi possível ler o arquivo.',true);}
    };
    r.readAsText(f);
    e.target.value='';
  };

  renderTopo();renderInicio();

  if('serviceWorker' in navigator){
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
