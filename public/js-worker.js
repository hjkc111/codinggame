let decide;
importScripts('/sdk.js');
self.onmessage=({data})=>{
  try{
    if(data.type==='load'){self.postMessage({id:data.id,ok:true});return;}
    if(data.type==='compile'){const entries=new Function(data.code+'\nreturn typeof decide === "function" ? decide : {scout,guard,hauler};')();if(typeof entries==='function')decide=entries;else{if(!Object.values(entries).every(x=>typeof x==='function'))throw Error('请定义 scout、guard、hauler');decide=(o,m)=>dispatch(entries,o,m);}self.postMessage({id:data.id,ok:true});return;}
    const result=decide(data.observation,data.memory);
    if(!Array.isArray(result)||result.length!==2)throw Error('需要返回 [actions, memory]');
    const encoded=JSON.stringify(result);
    if(encoded.length>100000)throw Error('返回数据超过 100 KB');
    const parsed=JSON.parse(encoded);
    self.postMessage({id:data.id,ok:true,actions:parsed[0],memory:parsed[1],output:[]});
  }catch(e){self.postMessage({id:data.id,ok:false,error:String(e)});}
};
