export class Runner {
  worker:Worker; next=0; closed=false;
  pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:ReturnType<typeof setTimeout>}>();
  constructor(language:string){
    this.worker=new Worker(language==='python'?'/python-worker.js':'/js-worker.js');
    this.worker.onmessage=({data})=>{const p=this.pending.get(data.id);if(!p)return;clearTimeout(p.timer);this.pending.delete(data.id);data.ok?p.resolve(data):p.reject(new Error(data.error));};
    this.worker.onerror=(e)=>this.close(e.message||'解释器加载失败');
  }
  request(type:string,data:object={},timeout=1200):Promise<any>{
    if(this.closed)return Promise.reject(new Error('解释器已停止，请重新运行'));
    const id=++this.next;
    return new Promise((resolve,reject)=>{const timer=setTimeout(()=>this.close('运行超时，已停止解释器。请检查无限循环后重新运行。'),timeout);this.pending.set(id,{resolve,reject,timer});this.worker.postMessage({id,type,...data});});
  }
  close(reason='执行已取消'){if(this.closed)return;this.closed=true;this.worker.terminate();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(new Error(reason));}this.pending.clear();}
}
