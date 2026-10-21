// [v5] π MCP server pure parts (scripts/mcp-server.ts, imported without starting stdio): letter parsing on natural
// Vietnamese replies and JSON-RPC validation (R3 review). The protocol over stdio is in tests/e2e/mcp.test.ts. Run: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handle, parseLetters, shortExplanation } from '../scripts/mcp-server.ts';

const MODERN = { 'io.modelcontextprotocol/protocolVersion': '2026-07-28', 'io.modelcontextprotocol/clientCapabilities': {} };

test('[R3] parseLetters: standalone A–H tokens only, never letters inside (Vietnamese) words', () => {
  const cases: [unknown, string[]][] = [
    ['B', ['B']],
    ['b, d', ['B', 'D']],
    ['BD', ['B', 'D']],
    ['B và D', ['B', 'D']],
    ['chọn B', ['B']],
    ['Chọn B và D', ['B', 'D']],
    ['B, chắc vậy', ['B']],
    ['đáp án C', ['C']],
    ['B (có lẽ)', ['B']],
    ['Em chọn D', ['D']],
    ['I pick A', ['A']],
    [['A', 'C'], ['A', 'C']],
    ['', []],
    [{ toString: 1 }, []],
    [[{ toString: 1 }, 'B'], ['B']],
    ['Đ', []],
    ['Bé', []],
  ];
  for (const [input, want] of cases) assert.deepEqual(parseLetters(input), want, JSON.stringify(input));
});

test('[R3] JSON-RPC: ids must be string / number, params an object, clientCapabilities an object', async () => {
  const err = async (msg: unknown) => ((await handle(msg as never)) as { id: unknown; error: { code: number } });
  const objectId = await err({ jsonrpc: '2.0', id: { a: 1 }, method: 'ping' });
  assert.equal(objectId.error.code, -32600);
  assert.equal(objectId.id, null, 'an object id is never echoed');
  assert.equal((await err({ jsonrpc: '2.0', id: 2, method: 'tools/call', params: [] })).error.code, -32602);
  assert.equal((await err({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: { _meta: { ...MODERN, 'io.modelcontextprotocol/clientCapabilities': null } } })).error.code, -32602);
  assert.equal((await err({ jsonrpc: '2.0', id: 4, method: 'tools/list', params: { _meta: { ...MODERN, 'io.modelcontextprotocol/clientCapabilities': [] } } })).error.code, -32602);
  assert.equal((await err([1, 2])).error.code, -32600);
  assert.equal((await err(null)).error.code, -32600);
  assert.equal(await handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), undefined, 'notifications get no answer');
  const ok = (await handle({ jsonrpc: '2.0', id: 'x', method: 'tools/list', params: { _meta: MODERN } })) as { result: { resultType: string; tools: unknown[] } };
  assert.equal(ok.result.resultType, 'complete');
  assert.equal(ok.result.tools.length, 7);
});

test('shortExplanation: the first paragraph + the 🇻🇳 line, plain text', () => {
  const md = '**Dedicated Hosts** expose sockets and cores.\n- Dedicated Instances: no host affinity.\n> 🇻🇳 BYOL theo socket → Dedicated Hosts.';
  assert.equal(shortExplanation(md), 'Dedicated Hosts expose sockets and cores.\n🇻🇳 BYOL theo socket → Dedicated Hosts.');
});
