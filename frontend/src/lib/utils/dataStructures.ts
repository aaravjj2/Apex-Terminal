// ============================================================================
// LRU Cache with TTL
// ============================================================================

export class LRUCache<K, V> {
  private cache = new Map<K, { value: V; expiresAt: number | null }>();
  private maxSize: number;
  private defaultTTL: number | null;

  constructor(maxSize = 100, defaultTTL: number | null = null) {
    this.maxSize = maxSize;
    this.defaultTTL = defaultTTL;
  }

  get(key: K): V | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, entry);
    return entry.value;
  }

  set(key: K, value: V, ttl?: number): void {
    this.cache.delete(key);
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) this.cache.delete(firstKey);
    }
    const effectiveTTL = ttl ?? this.defaultTTL;
    this.cache.set(key, {
      value,
      expiresAt: effectiveTTL ? Date.now() + effectiveTTL : null,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  get size(): number {
    return this.cache.size;
  }

  keys(): K[] {
    return [...this.cache.keys()];
  }

  values(): V[] {
    return [...this.cache.values()].map(e => e.value);
  }

  evictExpired(): number {
    let count = 0;
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (entry.expiresAt && now > entry.expiresAt) {
        this.cache.delete(key);
        count++;
      }
    }
    return count;
  }
}

// ============================================================================
// Priority Queue (Min-Heap / Max-Heap)
// ============================================================================

export class PriorityQueue<T> {
  private heap: T[] = [];
  private comparator: (a: T, b: T) => number;

  constructor(comparator: (a: T, b: T) => number = (a, b) => (a as number) - (b as number)) {
    this.comparator = comparator;
  }

  static minHeap<T>(key?: (item: T) => number): PriorityQueue<T> {
    return new PriorityQueue<T>((a, b) => (key ? key(a) - key(b) : (a as number) - (b as number)));
  }

  static maxHeap<T>(key?: (item: T) => number): PriorityQueue<T> {
    return new PriorityQueue<T>((a, b) => (key ? key(b) - key(a) : (b as number) - (a as number)));
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const last = this.heap.pop()!;
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  peek(): T | undefined {
    return this.heap[0];
  }

  get size(): number {
    return this.heap.length;
  }

  get isEmpty(): boolean {
    return this.heap.length === 0;
  }

  toArray(): T[] {
    return [...this.heap].sort(this.comparator);
  }

  private bubbleUp(idx: number): void {
    while (idx > 0) {
      const parent = (idx - 1) >> 1;
      if (this.comparator(this.heap[idx], this.heap[parent]) >= 0) break;
      [this.heap[idx], this.heap[parent]] = [this.heap[parent], this.heap[idx]];
      idx = parent;
    }
  }

  private sinkDown(idx: number): void {
    const n = this.heap.length;
    while (true) {
      let smallest = idx;
      const left = 2 * idx + 1, right = 2 * idx + 2;
      if (left < n && this.comparator(this.heap[left], this.heap[smallest]) < 0) smallest = left;
      if (right < n && this.comparator(this.heap[right], this.heap[smallest]) < 0) smallest = right;
      if (smallest === idx) break;
      [this.heap[idx], this.heap[smallest]] = [this.heap[smallest], this.heap[idx]];
      idx = smallest;
    }
  }
}

// ============================================================================
// Sorted Array (Binary Search Insert/Find)
// ============================================================================

export class SortedArray<T> {
  private items: T[] = [];
  private comparator: (a: T, b: T) => number;

  constructor(comparator: (a: T, b: T) => number = (a, b) => (a as number) - (b as number)) {
    this.comparator = comparator;
  }

  insert(item: T): number {
    const idx = this.findInsertIndex(item);
    this.items.splice(idx, 0, item);
    return idx;
  }

  find(item: T): number {
    let lo = 0, hi = this.items.length - 1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      const cmp = this.comparator(this.items[mid], item);
      if (cmp === 0) return mid;
      if (cmp < 0) lo = mid + 1; else hi = mid - 1;
    }
    return -1;
  }

  findRange(from: T, to: T): T[] {
    const startIdx = this.findInsertIndex(from);
    const result: T[] = [];
    for (let i = startIdx; i < this.items.length; i++) {
      if (this.comparator(this.items[i], to) > 0) break;
      result.push(this.items[i]);
    }
    return result;
  }

  remove(item: T): boolean {
    const idx = this.find(item);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  get(index: number): T | undefined {
    return this.items[index];
  }

  get length(): number {
    return this.items.length;
  }

  toArray(): T[] {
    return [...this.items];
  }

  private findInsertIndex(item: T): number {
    let lo = 0, hi = this.items.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (this.comparator(this.items[mid], item) < 0) lo = mid + 1; else hi = mid;
    }
    return lo;
  }
}

// ============================================================================
// Ring Buffer (Circular Buffer)
// ============================================================================

export class RingBuffer<T> {
  private buffer: (T | undefined)[];
  private head = 0;
  private tail = 0;
  private _size = 0;
  readonly capacity: number;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.buffer = new Array(capacity);
  }

  push(item: T): T | undefined {
    let evicted: T | undefined;
    if (this._size === this.capacity) {
      evicted = this.buffer[this.head];
      this.head = (this.head + 1) % this.capacity;
      this._size--;
    }
    this.buffer[this.tail] = item;
    this.tail = (this.tail + 1) % this.capacity;
    this._size++;
    return evicted;
  }

  shift(): T | undefined {
    if (this._size === 0) return undefined;
    const item = this.buffer[this.head];
    this.buffer[this.head] = undefined;
    this.head = (this.head + 1) % this.capacity;
    this._size--;
    return item;
  }

  peek(): T | undefined {
    return this._size > 0 ? this.buffer[this.head] : undefined;
  }

  peekLast(): T | undefined {
    if (this._size === 0) return undefined;
    return this.buffer[(this.tail - 1 + this.capacity) % this.capacity];
  }

  get(index: number): T | undefined {
    if (index < 0 || index >= this._size) return undefined;
    return this.buffer[(this.head + index) % this.capacity];
  }

  get size(): number { return this._size; }
  get isFull(): boolean { return this._size === this.capacity; }
  get isEmpty(): boolean { return this._size === 0; }

  toArray(): T[] {
    const result: T[] = [];
    for (let i = 0; i < this._size; i++) {
      result.push(this.buffer[(this.head + i) % this.capacity] as T);
    }
    return result;
  }

  clear(): void {
    this.buffer = new Array(this.capacity);
    this.head = 0;
    this.tail = 0;
    this._size = 0;
  }
}

// ============================================================================
// Trie (for Autocomplete)
// ============================================================================

interface TrieNode {
  children: Map<string, TrieNode>;
  isEnd: boolean;
  data?: unknown;
  weight: number;
}

export class Trie<T = string> {
  private root: TrieNode = { children: new Map(), isEnd: false, weight: 0 };

  insert(word: string, data?: T, weight = 0): void {
    let node = this.root;
    for (const char of word.toLowerCase()) {
      if (!node.children.has(char)) {
        node.children.set(char, { children: new Map(), isEnd: false, weight: 0 });
      }
      node = node.children.get(char)!;
    }
    node.isEnd = true;
    node.data = data;
    node.weight = weight;
  }

  search(word: string): T | undefined {
    const node = this.findNode(word.toLowerCase());
    return node?.isEnd ? node.data as T : undefined;
  }

  has(word: string): boolean {
    const node = this.findNode(word.toLowerCase());
    return node?.isEnd ?? false;
  }

  autocomplete(prefix: string, limit = 10): Array<{ word: string; data?: T; weight: number }> {
    const node = this.findNode(prefix.toLowerCase());
    if (!node) return [];

    const results: Array<{ word: string; data?: T; weight: number }> = [];
    this.collectWords(node, prefix.toLowerCase(), results);

    return results
      .sort((a, b) => b.weight - a.weight)
      .slice(0, limit);
  }

  private findNode(prefix: string): TrieNode | null {
    let node = this.root;
    for (const char of prefix) {
      if (!node.children.has(char)) return null;
      node = node.children.get(char)!;
    }
    return node;
  }

  private collectWords(
    node: TrieNode,
    prefix: string,
    results: Array<{ word: string; data?: T; weight: number }>
  ): void {
    if (node.isEnd) {
      results.push({ word: prefix, data: node.data as T, weight: node.weight });
    }
    for (const [char, child] of node.children) {
      this.collectWords(child, prefix + char, results);
    }
  }
}

// ============================================================================
// Interval Tree (for Time Range Queries)
// ============================================================================

interface IntervalNode<T> {
  lo: number;
  hi: number;
  max: number;
  data: T;
  left: IntervalNode<T> | null;
  right: IntervalNode<T> | null;
}

export class IntervalTree<T> {
  private root: IntervalNode<T> | null = null;

  insert(lo: number, hi: number, data: T): void {
    this.root = this.insertNode(this.root, lo, hi, data);
  }

  query(point: number): Array<{ lo: number; hi: number; data: T }> {
    const results: Array<{ lo: number; hi: number; data: T }> = [];
    this.queryPoint(this.root, point, results);
    return results;
  }

  queryRange(lo: number, hi: number): Array<{ lo: number; hi: number; data: T }> {
    const results: Array<{ lo: number; hi: number; data: T }> = [];
    this.queryOverlap(this.root, lo, hi, results);
    return results;
  }

  private insertNode(node: IntervalNode<T> | null, lo: number, hi: number, data: T): IntervalNode<T> {
    if (!node) return { lo, hi, max: hi, data, left: null, right: null };
    if (lo < node.lo) node.left = this.insertNode(node.left, lo, hi, data);
    else node.right = this.insertNode(node.right, lo, hi, data);
    node.max = Math.max(node.max, hi);
    return node;
  }

  private queryPoint(node: IntervalNode<T> | null, point: number, results: Array<{ lo: number; hi: number; data: T }>): void {
    if (!node || point > node.max) return;
    if (point >= node.lo && point <= node.hi) results.push({ lo: node.lo, hi: node.hi, data: node.data });
    this.queryPoint(node.left, point, results);
    if (point >= node.lo) this.queryPoint(node.right, point, results);
  }

  private queryOverlap(node: IntervalNode<T> | null, lo: number, hi: number, results: Array<{ lo: number; hi: number; data: T }>): void {
    if (!node || lo > node.max) return;
    if (node.lo <= hi && node.hi >= lo) results.push({ lo: node.lo, hi: node.hi, data: node.data });
    this.queryOverlap(node.left, lo, hi, results);
    if (hi >= node.lo) this.queryOverlap(node.right, lo, hi, results);
  }
}

// ============================================================================
// Bloom Filter
// ============================================================================

export class BloomFilter {
  private bits: Uint8Array;
  private numHashes: number;
  private size: number;

  constructor(expectedItems: number, falsePositiveRate = 0.01) {
    this.size = Math.ceil((-expectedItems * Math.log(falsePositiveRate)) / (Math.log(2) ** 2));
    this.numHashes = Math.ceil((this.size / expectedItems) * Math.log(2));
    this.bits = new Uint8Array(Math.ceil(this.size / 8));
  }

  add(item: string): void {
    for (const pos of this.getPositions(item)) {
      this.bits[pos >> 3] |= 1 << (pos & 7);
    }
  }

  has(item: string): boolean {
    for (const pos of this.getPositions(item)) {
      if (!(this.bits[pos >> 3] & (1 << (pos & 7)))) return false;
    }
    return true;
  }

  get estimatedFalsePositiveRate(): number {
    let setBits = 0;
    for (const byte of this.bits) {
      let b = byte;
      while (b) { setBits += b & 1; b >>= 1; }
    }
    return Math.pow(setBits / this.size, this.numHashes);
  }

  private getPositions(item: string): number[] {
    const positions: number[] = [];
    let h1 = 0, h2 = 0;
    for (let i = 0; i < item.length; i++) {
      h1 = Math.imul(h1 ^ item.charCodeAt(i), 0x01000193) >>> 0;
      h2 = Math.imul(h2 ^ item.charCodeAt(i), 0x811c9dc5) >>> 0;
    }
    for (let i = 0; i < this.numHashes; i++) {
      positions.push(((h1 + i * h2) >>> 0) % this.size);
    }
    return positions;
  }
}

// ============================================================================
// Skip List
// ============================================================================

interface SkipNode<K, V> {
  key: K;
  value: V;
  forward: Array<SkipNode<K, V> | null>;
}

export class SkipList<K, V> {
  private head: SkipNode<K, V>;
  private maxLevel: number;
  private level = 0;
  private _size = 0;
  private comparator: (a: K, b: K) => number;

  constructor(maxLevel = 16, comparator?: (a: K, b: K) => number) {
    this.maxLevel = maxLevel;
    this.comparator = comparator ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    this.head = { key: null as K, value: null as V, forward: new Array(maxLevel).fill(null) };
  }

  insert(key: K, value: V): void {
    const update: Array<SkipNode<K, V>> = new Array(this.maxLevel).fill(this.head);
    let current = this.head;

    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && this.comparator(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const next = current.forward[0];
    if (next && this.comparator(next.key, key) === 0) {
      next.value = value;
      return;
    }

    const newLevel = this.randomLevel();
    if (newLevel > this.level) {
      for (let i = this.level + 1; i <= newLevel; i++) update[i] = this.head;
      this.level = newLevel;
    }

    const node: SkipNode<K, V> = { key, value, forward: new Array(newLevel + 1).fill(null) };
    for (let i = 0; i <= newLevel; i++) {
      node.forward[i] = update[i].forward[i];
      update[i].forward[i] = node;
    }
    this._size++;
  }

  get(key: K): V | undefined {
    let current = this.head;
    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && this.comparator(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
    }
    const node = current.forward[0];
    return node && this.comparator(node.key, key) === 0 ? node.value : undefined;
  }

  delete(key: K): boolean {
    const update: Array<SkipNode<K, V>> = new Array(this.maxLevel).fill(this.head);
    let current = this.head;

    for (let i = this.level; i >= 0; i--) {
      while (current.forward[i] && this.comparator(current.forward[i]!.key, key) < 0) {
        current = current.forward[i]!;
      }
      update[i] = current;
    }

    const target = current.forward[0];
    if (!target || this.comparator(target.key, key) !== 0) return false;

    for (let i = 0; i <= this.level; i++) {
      if (update[i].forward[i] !== target) break;
      update[i].forward[i] = target.forward[i];
    }

    while (this.level > 0 && !this.head.forward[this.level]) this.level--;
    this._size--;
    return true;
  }

  get size(): number { return this._size; }

  private randomLevel(): number {
    let level = 0;
    while (Math.random() < 0.5 && level < this.maxLevel - 1) level++;
    return level;
  }
}

// ============================================================================
// B-Tree (for Indexed Storage)
// ============================================================================

export class BTree<K, V> {
  private root: BTreeNode<K, V>;
  private order: number;
  private comparator: (a: K, b: K) => number;

  constructor(order = 4, comparator?: (a: K, b: K) => number) {
    this.order = order;
    this.comparator = comparator ?? ((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    this.root = new BTreeNode<K, V>(true);
  }

  get(key: K): V | undefined {
    return this.searchNode(this.root, key);
  }

  insert(key: K, value: V): void {
    const root = this.root;
    if (root.keys.length === 2 * this.order - 1) {
      const newRoot = new BTreeNode<K, V>(false);
      newRoot.children.push(root);
      this.splitChild(newRoot, 0);
      this.root = newRoot;
    }
    this.insertNonFull(this.root, key, value);
  }

  private searchNode(node: BTreeNode<K, V>, key: K): V | undefined {
    let i = 0;
    while (i < node.keys.length && this.comparator(key, node.keys[i]) > 0) i++;
    if (i < node.keys.length && this.comparator(key, node.keys[i]) === 0) return node.values[i];
    if (node.isLeaf) return undefined;
    return this.searchNode(node.children[i], key);
  }

  private insertNonFull(node: BTreeNode<K, V>, key: K, value: V): void {
    let i = node.keys.length - 1;

    if (node.isLeaf) {
      while (i >= 0 && this.comparator(key, node.keys[i]) < 0) i--;
      if (i >= 0 && this.comparator(key, node.keys[i]) === 0) {
        node.values[i] = value;
        return;
      }
      node.keys.splice(i + 1, 0, key);
      node.values.splice(i + 1, 0, value);
    } else {
      while (i >= 0 && this.comparator(key, node.keys[i]) < 0) i--;
      if (i >= 0 && this.comparator(key, node.keys[i]) === 0) {
        node.values[i] = value;
        return;
      }
      i++;
      if (node.children[i].keys.length === 2 * this.order - 1) {
        this.splitChild(node, i);
        if (this.comparator(key, node.keys[i]) > 0) i++;
      }
      this.insertNonFull(node.children[i], key, value);
    }
  }

  private splitChild(parent: BTreeNode<K, V>, i: number): void {
    const t = this.order;
    const child = parent.children[i];
    const newNode = new BTreeNode<K, V>(child.isLeaf);

    parent.keys.splice(i, 0, child.keys[t - 1]);
    parent.values.splice(i, 0, child.values[t - 1]);
    parent.children.splice(i + 1, 0, newNode);

    newNode.keys = child.keys.splice(t);
    newNode.values = child.values.splice(t);
    child.keys.pop();
    child.values.pop();

    if (!child.isLeaf) {
      newNode.children = child.children.splice(t);
    }
  }
}

class BTreeNode<K, V> {
  keys: K[] = [];
  values: V[] = [];
  children: BTreeNode<K, V>[] = [];
  isLeaf: boolean;

  constructor(isLeaf: boolean) {
    this.isLeaf = isLeaf;
  }
}

// ============================================================================
// Disjoint Set (Union-Find)
// ============================================================================

export class DisjointSet<T> {
  private parent = new Map<T, T>();
  private rank = new Map<T, number>();

  makeSet(x: T): void {
    if (!this.parent.has(x)) {
      this.parent.set(x, x);
      this.rank.set(x, 0);
    }
  }

  find(x: T): T {
    if (!this.parent.has(x)) this.makeSet(x);
    let root = x;
    while (this.parent.get(root) !== root) root = this.parent.get(root)!;
    // Path compression
    let current = x;
    while (current !== root) {
      const next = this.parent.get(current)!;
      this.parent.set(current, root);
      current = next;
    }
    return root;
  }

  union(x: T, y: T): void {
    const rootX = this.find(x), rootY = this.find(y);
    if (rootX === rootY) return;

    const rankX = this.rank.get(rootX)!, rankY = this.rank.get(rootY)!;
    if (rankX < rankY) this.parent.set(rootX, rootY);
    else if (rankX > rankY) this.parent.set(rootY, rootX);
    else { this.parent.set(rootY, rootX); this.rank.set(rootX, rankX + 1); }
  }

  connected(x: T, y: T): boolean {
    return this.find(x) === this.find(y);
  }

  get components(): number {
    const roots = new Set<T>();
    for (const key of this.parent.keys()) roots.add(this.find(key));
    return roots.size;
  }
}
