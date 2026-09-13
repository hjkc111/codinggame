let py;
let scope;
let output = [];
let sdk;
self.onmessage = async ({data}) => {
  const {id, type} = data;
  try {
    if(type === 'load') {
      importScripts('/python/pyodide.js');
      py = await loadPyodide({indexURL:'/python/',stdout:s=>{if(output.length<8)output.push(s.slice(0,500));},stderr:s=>{if(output.length<8)output.push(s.slice(0,500));}});
      sdk = await (await fetch('/sdk.py')).text();
      self.postMessage({id,ok:true}); return;
    }
    output=[];
    if(type === 'compile') {
      scope = py.runPython('dict()');
      py.runPython(sdk,{globals:scope,filename:'sdk.py'});
      py.runPython(data.code,{globals:scope,filename:'strategy.py'});
      py.runPython("if 'decide' not in globals():\n    assert all(callable(globals().get(n)) for n in ('scout', 'guard', 'hauler')), '请定义 scout、guard、hauler 三个函数，或旧版 decide'\n    decide = _dispatch",{globals:scope});
      self.postMessage({id,ok:true});return;
    }
    scope.set('_obs_json',JSON.stringify(data.observation));
    scope.set('_mem_json',JSON.stringify(data.memory));
    const result=py.runPython(`import json\n_result = decide(json.loads(_obs_json), json.loads(_mem_json))\njson.dumps(_result, allow_nan=False)`,{globals:scope,filename:'runner.py'});
    if(result.length>100000)throw new Error('返回数据超过 100 KB');
    const parsed=JSON.parse(result);
    if(!Array.isArray(parsed)||parsed.length!==2)throw new Error('需要返回 actions, memory');
    self.postMessage({id,ok:true,actions:parsed[0],memory:parsed[1],output});
  }catch(e){self.postMessage({id,ok:false,error:String(e).slice(0,3000)});}
};
