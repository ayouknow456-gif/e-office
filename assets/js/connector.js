/* GAS JSONP bridge for GitHub Pages. Configure URL and API key in Settings. */
(function(){
  const CFG_KEY='eoffice-gas-connection-v1';
  function config(){ try{return JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}catch(_){return {}} }
  function save(cfg){localStorage.setItem(CFG_KEY,JSON.stringify(cfg||{}));}
  function call(action,data){
    const cfg=config();
    if(!cfg.url) return Promise.reject(new Error('กรุณากำหนด GAS Web App URL ในหน้าตั้งค่า'));
    return new Promise((resolve,reject)=>{
      const cb='eo_cb_'+Date.now()+'_'+Math.random().toString(36).slice(2);
      const script=document.createElement('script');
      const timer=setTimeout(()=>finish(new Error('หมดเวลารอ GAS กรุณาตรวจ URL และสิทธิ์การเผยแพร่')),25000);
      function finish(err,result){clearTimeout(timer);delete window[cb];script.remove();err?reject(err):resolve(result);}
      window[cb]=(result)=>{ if(result && result.success===false) finish(new Error(result.error||'GAS request failed')); else finish(null,result); };
      const params=new URLSearchParams({action,callback:cb,payload:JSON.stringify(data||{})});
      if(cfg.apiKey) params.set('key',cfg.apiKey);
      script.onerror=()=>finish(new Error('เรียก GAS ไม่สำเร็จ กรุณาตรวจ URL / Deployment'));
      script.src=cfg.url+(cfg.url.includes('?')?'&':'?')+params.toString();
      document.head.appendChild(script);
    });
  }
  window.EOGAS={config,save,call,test:()=>call('health',{})};
})();
