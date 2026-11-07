import {test} from 'node:test';
import assert from 'node:assert/strict';
import {executionSourceKey,executionStatusKey,executionStatuses,executionApiOrigin} from './execution';
import {translate} from './i18n';
test('execution sources never label unknown or fake results as real Codex output',()=>{
 assert.equal(executionSourceKey('codex'),'execution.source.codex');
 for(const source of ['simulation','legacy_simulation'])assert.equal(executionSourceKey(source),'execution.source.simulation');
 assert.equal(executionSourceKey('preview'),'execution.source.preview');assert.equal(executionSourceKey('manual'),'copy.localBoardUpdate');assert.equal(executionSourceKey('unexpected'),'execution.source.unknown');
});
test('strict owner sessions keep a consistent loopback hostname without rewriting external hosts',()=>{
 assert.equal(executionApiOrigin('http://127.0.0.1:4100','localhost'),'http://localhost:4100');assert.equal(executionApiOrigin('http://localhost:4100','127.0.0.1'),'http://127.0.0.1:4100');assert.equal(executionApiOrigin('http://127.0.0.1:4100'),'http://127.0.0.1:4100');assert.equal(executionApiOrigin('https://api.example.test','localhost'),'https://api.example.test');assert.equal(executionApiOrigin('http://127.0.0.1:4100','untrusted.example'),'http://127.0.0.1:4100');
});
test('job states and approval preview copy resolve in Turkish and English without shared labels',()=>{
 const keys=[...executionStatuses.map(executionStatusKey),executionStatusKey('unexpected'),...['codex','simulation','preview','unexpected'].map(executionSourceKey),'execution.title','execution.boundary','execution.noApproval','execution.changeInvalidates','execution.permissions'];
 for(const key of keys){const tr=translate('tr-TR',key),en=translate('en-US',key);assert.notEqual(tr,'Çeviri kullanılamıyor');assert.notEqual(en,'Translation unavailable');assert.notEqual(tr,en);}
});
