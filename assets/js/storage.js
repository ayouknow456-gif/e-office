/* Shared storage adapter: GAS Sheets when configured, IndexedDB local fallback. */
(function () {
  const DB_NAME='eoffice-workspace-v2', STORE='records'; let dbPromise;
  function openDb(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{if(!('indexedDB'in window))return reject(new Error('อุปกรณ์นี้ไม่รองรับ IndexedDB'));const r=indexedDB.open(DB_NAME,1);r.onupgradeneeded=()=>{if(!r.result.objectStoreNames.contains(STORE))r.result.createObjectStore(STORE,{keyPath:'key'});};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});return dbPromise;}
  async function getRecord(key){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readonly'),r=tx.objectStore(STORE).get(key);r.onsuccess=()=>resolve(r.result?r.result.value:null);r.onerror=()=>reject(r.error);});}
  async function putRecord(key,value){const db=await openDb();return new Promise((resolve,reject)=>{const tx=db.transaction(STORE,'readwrite');tx.objectStore(STORE).put({key,value});tx.oncomplete=()=>resolve(true);tx.onerror=()=>reject(tx.error);});}
  async function remote(){return !!(window.EOGAS&&window.EOGAS.config().url);}
  const defaults={profile:{orgName:'ส่วนราชการเจ้าของหนังสือ',orgAddress:'',orgPhone:'',orgEmail:'',profileName:'ผู้ปฏิบัติงาน',seals:[],garudas:[],selectedSeal:'',selectedExternalGaruda:'',selectedMemoGaruda:''},documents:[]};
  async function remoteSaveAsset(asset,kind){
    const raw=asset.dataUrl||''; const cacheKey='eoffice-uploaded-assets-v1'; let cache={}; try{cache=JSON.parse(localStorage.getItem(cacheKey)||'{}')}catch(_){}
    if(cache[asset.id]===raw.length) return;
    const meta={id:asset.id,name:asset.name,type:asset.type,kind};
    await window.EOGAS.call('assetStart',meta);
    const chunkSize=800;
    for(let i=0;i<raw.length;i+=chunkSize) await window.EOGAS.call('assetChunk',{id:asset.id,kind,index:Math.floor(i/chunkSize),chunk:raw.slice(i,i+chunkSize)});
    await window.EOGAS.call('assetFinish',{id:asset.id,kind,total:raw.length});
    cache[asset.id]=raw.length; localStorage.setItem(cacheKey,JSON.stringify(cache));
  }
  window.EOStorage={defaults,
    async getProfile(){if(await remote()){const r=await window.EOGAS.call('getProfile',{});return Object.assign(structuredClone(defaults.profile),r.data||{});}return (await getRecord('profile'))||structuredClone(defaults.profile);},
    async saveProfile(profile){if(await remote()){
      const clean={...profile,seals:(profile.seals||[]).map(({dataUrl,...a})=>a),garudas:(profile.garudas||[]).map(({dataUrl,...a})=>a)};
      await window.EOGAS.call('saveProfile',{profile:clean});
      for(const a of profile.seals||[]) await remoteSaveAsset(a,'seals');
      for(const a of profile.garudas||[]) await remoteSaveAsset(a,'garudas');
      return true;
    }return putRecord('profile',profile);},
    async listDocuments(){if(await remote()){const r=await window.EOGAS.call('listDocuments',{});return r.data||[];}return (await getRecord('documents'))||[];},
    async saveDocument(doc){if(await remote()){const r=await window.EOGAS.call('saveDocument',{document:doc});return r.data||doc;}const items=await this.listDocuments();const i=items.findIndex(x=>x.id===doc.id);if(i>=0)items[i]=doc;else items.unshift(doc);await putRecord('documents',items);return doc;},
    async deleteDocument(id){if(await remote())return window.EOGAS.call('deleteDocument',{id});const items=await this.listDocuments();await putRecord('documents',items.filter(x=>x.id!==id));},
    async getDocument(id){if(await remote()){const r=await window.EOGAS.call('getDocument',{id});return r.data||null;}return (await this.listDocuments()).find(x=>x.id===id)||null;},
    async getAllAssets(){const p=await this.getProfile();return {seals:p.seals||[],garudas:p.garudas||[]};},
    async clearAll(){if(await remote())throw new Error('ไม่อนุญาตให้ล้างฐานข้อมูลกลางจากหน้าเว็บ');await putRecord('profile',defaults.profile);await putRecord('documents',[]);}
  };
})();
