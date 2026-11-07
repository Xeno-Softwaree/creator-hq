import {test} from 'node:test';
import assert from 'node:assert/strict';
import {inspectPublicFile} from './public-audit.mjs';
test('release audit rejects sensitive files and does not echo contents',()=>{
 for(const path of ['private/notes.md','vaults/story.md','data/creator.db','renders/output.mp4','.env.local','backups/data.sql','notes/session.log'])assert.ok(inspectPublicFile(path).length,path);
 const key=['-----BEGIN',' PRIVATE KEY-----'].join('');assert.ok(inspectPublicFile('example.txt',key).includes('private-key'));
 const token=['sk','-proj-', 'x'.repeat(40)].join('');assert.deepEqual(inspectPublicFile('example.txt',token),['credential-token']);
 const machinePath=['C:',String.fromCharCode(92),'Users',String.fromCharCode(92),'owner',String.fromCharCode(92),'notes'].join('');assert.ok(inspectPublicFile('example.txt',machinePath).includes('machine-specific-absolute-path'));
 assert.ok(inspectPublicFile('example.txt',['postgresql',':/','/user:password@database'].join('')).includes('connection-secret'));
});
test('safe source, relative paths and documented placeholders pass',()=>{
 assert.deepEqual(inspectPublicFile('.env.example','DATABASE_URL="file:./creator.db"'),[]);
 assert.deepEqual(inspectPublicFile('docs/architecture.md','Use ./private/vaults for local storage.'),[]);
 assert.deepEqual(inspectPublicFile('apps/web/src/locales/tr-TR.json','{"nav.overview":"Genel Bakış"}'),[]);
 assert.deepEqual(inspectPublicFile('apps/api/prisma/postgresql/security/prepare-schema.sql','CREATE SCHEMA IF NOT EXISTS creator_hq;'),[]);
 assert.ok(inspectPublicFile('apps/api/prisma/postgresql/security/unreviewed.sql','SELECT 1;').includes('private-or-generated-artifact'));
});
