// Local QA only. All results here are fixtures, never production product judgments.
import { createServer } from 'node:http';
const sources = [ {title:'测试夹具 · 产品宣传',url:'https://brand.example/product',content:'测试产品宣传了未经验证的功效。'}, {title:'测试夹具 · 独立测评',url:'https://review.example/test',content:'测试产品的独立测评没有支持核心宣传。'} ];
const judgment = { product:'接口测试产品', evidence:'sufficient', probability:78, summary:'这是本地测试夹具，用于验证页面和接口。', reasons:[{title:'本地测试理由',detail:'本条结论为测试数据，不对应真实产品。',sourceIds:[1,2]}], advice:'本地测试已完成，可以重新输入真实产品。', uncertainty:'测试数据，仅用于软件验证。' };
createServer(async (req,res) => {
  const url=new URL(req.url,'http://127.0.0.1:4318');
  let data={};
  if(url.pathname==='/search') data={results:sources};
  if(url.pathname==='/v1/chat/completions') {
    let body=''; for await(const chunk of req) body+=chunk;
    const incoming=JSON.parse(body);
    if(incoming.messages[1].content.includes('无资料测试')) judgment.evidence='insufficient'; else judgment.evidence='sufficient';
    data={choices:[{finish_reason:'stop',message:{content:JSON.stringify(judgment)}}]};
  }
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(data));
}).listen(4318,'127.0.0.1',()=>console.log('QA fixtures http://127.0.0.1:4318'));
