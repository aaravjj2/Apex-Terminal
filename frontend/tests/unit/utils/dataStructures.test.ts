import { describe, it, expect } from 'vitest';
import {
  LRUCache, PriorityQueue, SortedArray, RingBuffer,
  Trie, IntervalTree, BloomFilter,
  SkipList, BTree, DisjointSet,
} from '../../../src/lib/utils/dataStructures';

describe('LRUCache', () => {
  it('stores and retrieves values', () => {
    const cache = new LRUCache<string, number>(10);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBe(2);
  });

  it('evicts least recently used when full', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.set('d', 4);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.get('d')).toBe(4);
    expect(cache.size).toBe(3);
  });

  it('accessing refreshes recency', () => {
    const cache = new LRUCache<string, number>(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);
    cache.get('a');
    cache.set('d', 4);
    expect(cache.get('a')).toBe(1);
    expect(cache.get('b')).toBeUndefined();
  });

  it('has checks existence', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('x', 42);
    expect(cache.has('x')).toBe(true);
    expect(cache.has('y')).toBe(false);
  });

  it('delete removes entry', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    expect(cache.delete('a')).toBe(true);
    expect(cache.get('a')).toBeUndefined();
    expect(cache.size).toBe(0);
  });

  it('clear empties cache', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('keys and values return all entries', () => {
    const cache = new LRUCache<string, number>(5);
    cache.set('a', 1);
    cache.set('b', 2);
    expect(cache.keys().sort()).toEqual(['a', 'b']);
    expect(cache.values().sort()).toEqual([1, 2]);
  });

  it('TTL expires entries', async () => {
    const cache = new LRUCache<string, number>(5, 50);
    cache.set('a', 1);
    await new Promise(r => setTimeout(r, 80));
    cache.evictExpired();
    expect(cache.get('a')).toBeUndefined();
  });

  it('per-entry TTL overrides default', async () => {
    const cache = new LRUCache<string, number>(5, 1000);
    cache.set('a', 1, 50);
    await new Promise(r => setTimeout(r, 80));
    cache.evictExpired();
    expect(cache.get('a')).toBeUndefined();
  });
});

describe('PriorityQueue', () => {
  it('minHeap pops smallest first', () => {
    const pq = PriorityQueue.minHeap<number>();
    pq.push(5);
    pq.push(1);
    pq.push(3);
    expect(pq.pop()).toBe(1);
    expect(pq.pop()).toBe(3);
    expect(pq.pop()).toBe(5);
  });

  it('maxHeap pops largest first', () => {
    const pq = PriorityQueue.maxHeap<number>();
    pq.push(5);
    pq.push(1);
    pq.push(3);
    expect(pq.pop()).toBe(5);
    expect(pq.pop()).toBe(3);
    expect(pq.pop()).toBe(1);
  });

  it('peek returns top without removing', () => {
    const pq = PriorityQueue.minHeap<number>();
    pq.push(10);
    pq.push(5);
    expect(pq.peek()).toBe(5);
    expect(pq.size).toBe(2);
  });

  it('isEmpty returns true for empty queue', () => {
    const pq = PriorityQueue.minHeap<number>();
    expect(pq.isEmpty).toBe(true);
    pq.push(1);
    expect(pq.isEmpty).toBe(false);
  });

  it('custom key extraction', () => {
    const pq = PriorityQueue.minHeap<{ v: number }>(item => item.v);
    pq.push({ v: 30 });
    pq.push({ v: 10 });
    pq.push({ v: 20 });
    expect(pq.pop()!.v).toBe(10);
  });

  it('toArray returns all elements', () => {
    const pq = PriorityQueue.minHeap<number>();
    [4, 2, 6, 1, 3].forEach(v => pq.push(v));
    const arr = pq.toArray();
    expect(arr.length).toBe(5);
    expect(arr.sort()).toEqual([1, 2, 3, 4, 6]);
  });

  it('pop from empty returns undefined', () => {
    const pq = PriorityQueue.minHeap<number>();
    expect(pq.pop()).toBeUndefined();
  });
});

describe('SortedArray', () => {
  it('insert maintains sort order', () => {
    const sa = new SortedArray<number>();
    sa.insert(5);
    sa.insert(1);
    sa.insert(3);
    expect(sa.toArray()).toEqual([1, 3, 5]);
  });

  it('find returns index', () => {
    const sa = new SortedArray<number>();
    [10, 20, 30].forEach(v => sa.insert(v));
    expect(sa.find(20)).toBeGreaterThanOrEqual(0);
  });

  it('findRange returns elements in bounds', () => {
    const sa = new SortedArray<number>();
    [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].forEach(v => sa.insert(v));
    const range = sa.findRange(3, 7);
    expect(range).toEqual([3, 4, 5, 6, 7]);
  });

  it('remove deletes item', () => {
    const sa = new SortedArray<number>();
    [1, 2, 3].forEach(v => sa.insert(v));
    expect(sa.remove(2)).toBe(true);
    expect(sa.toArray()).toEqual([1, 3]);
  });

  it('get retrieves by index', () => {
    const sa = new SortedArray<number>();
    [5, 1, 3].forEach(v => sa.insert(v));
    expect(sa.get(0)).toBe(1);
    expect(sa.get(2)).toBe(5);
  });

  it('length tracks count', () => {
    const sa = new SortedArray<number>();
    expect(sa.length).toBe(0);
    sa.insert(1);
    sa.insert(2);
    expect(sa.length).toBe(2);
  });
});

describe('RingBuffer', () => {
  it('push and shift work FIFO', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    expect(rb.shift()).toBe(1);
    expect(rb.shift()).toBe(2);
  });

  it('overwrites oldest when full', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.push(3);
    const evicted = rb.push(4);
    expect(evicted).toBe(1);
    expect(rb.toArray()).toEqual([2, 3, 4]);
  });

  it('peek returns oldest', () => {
    const rb = new RingBuffer<number>(5);
    rb.push(10);
    rb.push(20);
    expect(rb.peek()).toBe(10);
  });

  it('peekLast returns newest', () => {
    const rb = new RingBuffer<number>(5);
    rb.push(10);
    rb.push(20);
    expect(rb.peekLast()).toBe(20);
  });

  it('isFull and isEmpty work', () => {
    const rb = new RingBuffer<number>(2);
    expect(rb.isEmpty).toBe(true);
    rb.push(1);
    expect(rb.isEmpty).toBe(false);
    rb.push(2);
    expect(rb.isFull).toBe(true);
  });

  it('get accesses by index', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(10);
    rb.push(20);
    rb.push(30);
    expect(rb.get(0)).toBe(10);
    expect(rb.get(2)).toBe(30);
  });

  it('clear resets buffer', () => {
    const rb = new RingBuffer<number>(3);
    rb.push(1);
    rb.push(2);
    rb.clear();
    expect(rb.size).toBe(0);
    expect(rb.isEmpty).toBe(true);
  });
});

describe('Trie', () => {
  it('insert and search', () => {
    const trie = new Trie<number>();
    trie.insert('apple', 1);
    trie.insert('app', 2);
    expect(trie.search('apple')).toBe(1);
    expect(trie.search('app')).toBe(2);
    expect(trie.search('ap')).toBeUndefined();
  });

  it('has checks existence', () => {
    const trie = new Trie<string>();
    trie.insert('hello', 'world');
    expect(trie.has('hello')).toBe(true);
    expect(trie.has('hell')).toBe(false);
  });

  it('autocomplete returns prefix matches', () => {
    const trie = new Trie<string>();
    trie.insert('apple', 'fruit');
    trie.insert('application', 'software');
    trie.insert('apply', 'action');
    trie.insert('banana', 'fruit');
    const results = trie.autocomplete('app');
    expect(results.length).toBe(3);
    expect(results.every(r => r.word.startsWith('app'))).toBe(true);
  });

  it('autocomplete respects limit', () => {
    const trie = new Trie();
    for (let i = 0; i < 20; i++) trie.insert(`word${i}`);
    const results = trie.autocomplete('word', 5);
    expect(results.length).toBe(5);
  });

  it('autocomplete sorts by weight', () => {
    const trie = new Trie<string>();
    trie.insert('abc', 'low', 1);
    trie.insert('abd', 'high', 10);
    trie.insert('abe', 'mid', 5);
    const results = trie.autocomplete('ab');
    expect(results[0].weight).toBeGreaterThanOrEqual(results[1].weight);
  });
});

describe('IntervalTree', () => {
  it('point query finds overlapping intervals', () => {
    const tree = new IntervalTree<string>();
    tree.insert(1, 5, 'A');
    tree.insert(3, 7, 'B');
    tree.insert(8, 10, 'C');
    const at4 = tree.query(4);
    expect(at4.length).toBe(2);
    expect(at4.map(r => r.data).sort()).toEqual(['A', 'B']);
  });

  it('point query misses non-overlapping', () => {
    const tree = new IntervalTree<string>();
    tree.insert(1, 3, 'X');
    expect(tree.query(5).length).toBe(0);
  });

  it('range query finds overlapping intervals', () => {
    const tree = new IntervalTree<string>();
    tree.insert(1, 5, 'A');
    tree.insert(6, 10, 'B');
    tree.insert(4, 8, 'C');
    const result = tree.queryRange(3, 7);
    expect(result.length).toBeGreaterThanOrEqual(2);
  });
});

describe('BloomFilter', () => {
  it('added items test positive', () => {
    const bf = new BloomFilter(1000, 0.01);
    bf.add('hello');
    bf.add('world');
    expect(bf.has('hello')).toBe(true);
    expect(bf.has('world')).toBe(true);
  });

  it('unadded items mostly test negative', () => {
    const bf = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 100; i++) bf.add(`item_${i}`);
    let falsePositives = 0;
    for (let i = 100; i < 200; i++) {
      if (bf.has(`item_${i}`)) falsePositives++;
    }
    expect(falsePositives / 100).toBeLessThan(0.1);
  });

  it('estimated FP rate is reasonable', () => {
    const bf = new BloomFilter(1000, 0.01);
    for (let i = 0; i < 1000; i++) bf.add(`x${i}`);
    expect(bf.estimatedFalsePositiveRate).toBeLessThan(0.5);
  });
});

describe('SkipList', () => {
  it('insert and get', () => {
    const sl = new SkipList<number, string>();
    sl.insert(3, 'three');
    sl.insert(1, 'one');
    sl.insert(2, 'two');
    expect(sl.get(1)).toBe('one');
    expect(sl.get(2)).toBe('two');
    expect(sl.get(3)).toBe('three');
  });

  it('delete removes entry', () => {
    const sl = new SkipList<number, string>();
    sl.insert(1, 'a');
    sl.insert(2, 'b');
    expect(sl.delete(1)).toBe(true);
    expect(sl.get(1)).toBeUndefined();
    expect(sl.size).toBe(1);
  });

  it('get returns undefined for missing key', () => {
    const sl = new SkipList<number, string>();
    expect(sl.get(999)).toBeUndefined();
  });

  it('size tracks count', () => {
    const sl = new SkipList<number, number>();
    expect(sl.size).toBe(0);
    sl.insert(1, 10);
    sl.insert(2, 20);
    expect(sl.size).toBe(2);
  });
});

describe('BTree', () => {
  it('insert and get', () => {
    const bt = new BTree<number, string>(4);
    bt.insert(10, 'ten');
    bt.insert(5, 'five');
    bt.insert(20, 'twenty');
    expect(bt.get(10)).toBe('ten');
    expect(bt.get(5)).toBe('five');
    expect(bt.get(20)).toBe('twenty');
  });

  it('handles many insertions', () => {
    const bt = new BTree<number, number>(3);
    for (let i = 0; i < 100; i++) bt.insert(i, i * 10);
    for (let i = 0; i < 100; i++) expect(bt.get(i)).toBe(i * 10);
  });

  it('returns undefined for missing key', () => {
    const bt = new BTree<number, string>();
    expect(bt.get(42)).toBeUndefined();
  });
});

describe('DisjointSet', () => {
  it('makeSet and find', () => {
    const ds = new DisjointSet<number>();
    ds.makeSet(1);
    ds.makeSet(2);
    expect(ds.find(1)).toBe(1);
    expect(ds.find(2)).toBe(2);
  });

  it('union merges sets', () => {
    const ds = new DisjointSet<number>();
    ds.makeSet(1);
    ds.makeSet(2);
    ds.makeSet(3);
    ds.union(1, 2);
    expect(ds.connected(1, 2)).toBe(true);
    expect(ds.connected(1, 3)).toBe(false);
  });

  it('transitive connectivity', () => {
    const ds = new DisjointSet<string>();
    ds.makeSet('a');
    ds.makeSet('b');
    ds.makeSet('c');
    ds.union('a', 'b');
    ds.union('b', 'c');
    expect(ds.connected('a', 'c')).toBe(true);
  });

  it('components count decreases with union', () => {
    const ds = new DisjointSet<number>();
    ds.makeSet(1);
    ds.makeSet(2);
    ds.makeSet(3);
    expect(ds.components).toBe(3);
    ds.union(1, 2);
    expect(ds.components).toBe(2);
    ds.union(2, 3);
    expect(ds.components).toBe(1);
  });

  it('union of already connected is no-op', () => {
    const ds = new DisjointSet<number>();
    ds.makeSet(1);
    ds.makeSet(2);
    ds.union(1, 2);
    ds.union(1, 2);
    expect(ds.components).toBe(1);
  });
});
