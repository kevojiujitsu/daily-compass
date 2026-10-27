import test from 'node:test';
import assert from 'node:assert/strict';
import {communityInput,checkCommunityContent} from '../community-safety.mjs';
test('does not inspect private journals or send content without explicit sharing consent',async()=>{
 let calls=0;const fetchImpl=async()=>{calls++;throw Error('Unexpected');};
 await checkCommunityContent({action:'find',text:'private'},{fetchImpl});
 await assert.rejects(checkCommunityContent({action:'post',text:'hello'},{apiKey:'test',fetchImpl}),/permission/);
 assert.equal(calls,0);
 assert.throws(()=>communityInput({action:'post',moderationConsent:true,photo:'https://example.invalid/image.png'}),/Choose/);
});
test('checks only submitted sharing fields, rejecting flagged content before mutation',async()=>{
 let sent;const body={action:'profile',moderationConsent:true,profile:{quote:'A quiet morning',age:30},journal:'private journal'};
 await checkCommunityContent(body,{apiKey:'test',displayName:'Screenshot account',fetchImpl:async(url,options)=>{sent=JSON.parse(options.body);return {ok:true,json:async()=>({results:[{flagged:false}]})};}});
 assert.equal(sent.model,'omni-moderation-latest');assert.match(sent.input[0].text,/A quiet morning/);assert.doesNotMatch(JSON.stringify(sent),/private journal|30/);
 await assert.rejects(checkCommunityContent({action:'comment',moderationConsent:true,text:'flagged fixture'},{apiKey:'test',fetchImpl:async()=>({ok:true,json:async()=>({results:[{flagged:true}]})})}),/could not be shared/);
});
test('fails closed on unavailable or malformed checks; supports permitted inline images',async()=>{
 const body={action:'post',moderationConsent:true,photo:'data:image/png;base64,aGVsbG8='};let input;
 await checkCommunityContent(body,{apiKey:'test',fetchImpl:async(_,o)=>{input=JSON.parse(o.body).input;return{ok:true,json:async()=>({results:[{flagged:false}]})};}});
 assert.equal(input[0].type,'image_url');
 for(const result of [{ok:false},{ok:true,json:async()=>({results:[]})},{ok:true,json:async()=>({results:[{}]})}])await assert.rejects(checkCommunityContent(body,{apiKey:'test',fetchImpl:async()=>result}),/unavailable/);
 await assert.rejects(checkCommunityContent(body),/unavailable/);
});
