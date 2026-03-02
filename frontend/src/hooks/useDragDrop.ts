/**
 * useDragDrop.ts
 * Drag and drop hook with draggable element management, drop zones,
 * drag preview, sort/reorder, cross-container dragging, and touch support.
 */

import { useState, useCallback, useRef, useEffect } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface DragItem<T = any> {
  id: string;
  type: string;
  data: T;
  sourceContainerId?: string;
  index: number;
}

export interface DropResult {
  containerId: string;
  index: number;
  item: DragItem;
}

export interface DragState {
  isDragging: boolean;
  dragItem: DragItem | null;
  dragOverContainerId: string | null;
  dragOverIndex: number | null;
  dragPosition: { x: number; y: number };
  dropTarget: { containerId: string; index: number } | null;
}

export interface UseDraggableOptions<T = any> {
  id: string;
  type: string;
  data: T;
  containerId?: string;
  index: number;
  disabled?: boolean;
  onDragStart?: (item: DragItem<T>) => void;
  onDragEnd?: (result: DropResult | null) => void;
}

export interface UseDropzoneOptions {
  containerId: string;
  accept: string[];
  onDrop?: (result: DropResult) => void;
  onDragOver?: (item: DragItem, index: number) => void;
  onDragLeave?: () => void;
  disabled?: boolean;
}

export interface UseSortableOptions<T = any> {
  containerId: string;
  items: T[];
  type: string;
  getId: (item: T) => string;
  onReorder: (items: T[], fromIndex: number, toIndex: number) => void;
  disabled?: boolean;
}

// ─── Shared State ──────────────────────────────────────────────────────────────

let globalDragState: DragState = {
  isDragging: false,
  dragItem: null,
  dragOverContainerId: null,
  dragOverIndex: null,
  dragPosition: { x: 0, y: 0 },
  dropTarget: null,
};

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach(fn => fn());
}

function setGlobalDragState(update: Partial<DragState>) {
  globalDragState = { ...globalDragState, ...update };
  notifyListeners();
}

// ─── useDraggable ──────────────────────────────────────────────────────────────

export function useDraggable<T = any>(options: UseDraggableOptions<T>) {
  const { id, type, data, containerId, index, disabled = false, onDragStart, onDragEnd } = options;
  const elementRef = useRef<HTMLElement | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback((e: DragEvent | TouchEvent) => {
    if (disabled) return;

    const item: DragItem<T> = { id, type, data, sourceContainerId: containerId, index };

    if ('dataTransfer' in e && e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('application/json', JSON.stringify({ id, type, index, containerId }));
    }

    setGlobalDragState({ isDragging: true, dragItem: item, dropTarget: null });
    setIsDragging(true);
    onDragStart?.(item);
  }, [id, type, data, containerId, index, disabled, onDragStart]);

  const handleDragEnd = useCallback(() => {
    const result = globalDragState.dropTarget
      ? { containerId: globalDragState.dropTarget.containerId, index: globalDragState.dropTarget.index, item: globalDragState.dragItem! }
      : null;

    setGlobalDragState({
      isDragging: false, dragItem: null, dragOverContainerId: null,
      dragOverIndex: null, dropTarget: null,
    });
    setIsDragging(false);
    onDragEnd?.(result);
  }, [onDragEnd]);

  const dragProps = useCallback(() => ({
    draggable: !disabled,
    onDragStart: (e: React.DragEvent) => handleDragStart(e.nativeEvent),
    onDragEnd: handleDragEnd,
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      setGlobalDragState({ dragPosition: { x: touch.clientX, y: touch.clientY } });
      handleDragStart(e.nativeEvent);
    },
    onTouchMove: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      setGlobalDragState({ dragPosition: { x: touch.clientX, y: touch.clientY } });
    },
    onTouchEnd: handleDragEnd,
    style: { cursor: disabled ? 'default' : 'grab', opacity: isDragging ? 0.5 : 1 } as React.CSSProperties,
    'data-drag-id': id,
    'data-drag-type': type,
  }), [disabled, isDragging, id, type, handleDragStart, handleDragEnd]);

  return { dragProps, isDragging, ref: elementRef };
}

// ─── useDropzone ───────────────────────────────────────────────────────────────

export function useDropzone(options: UseDropzoneOptions) {
  const { containerId, accept, onDrop, onDragOver, onDragLeave, disabled = false } = options;
  const [isOver, setIsOver] = useState(false);
  const elementRef = useRef<HTMLElement | null>(null);

  const handleDragOver = useCallback((e: React.DragEvent, index?: number) => {
    if (disabled) return;
    e.preventDefault();
    e.stopPropagation();

    const item = globalDragState.dragItem;
    if (!item || !accept.includes(item.type)) return;

    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);

    const dropIdx = index ?? 0;
    setGlobalDragState({
      dragOverContainerId: containerId,
      dragOverIndex: dropIdx,
      dropTarget: { containerId, index: dropIdx },
    });
    onDragOver?.(item, dropIdx);
  }, [disabled, accept, containerId, onDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (elementRef.current?.contains(related)) return;
    setIsOver(false);
    if (globalDragState.dragOverContainerId === containerId) {
      setGlobalDragState({ dragOverContainerId: null, dragOverIndex: null });
    }
    onDragLeave?.();
  }, [containerId, onDragLeave]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsOver(false);

    const item = globalDragState.dragItem;
    if (!item || !accept.includes(item.type) || disabled) return;

    const result: DropResult = {
      containerId,
      index: globalDragState.dragOverIndex ?? 0,
      item,
    };
    onDrop?.(result);
  }, [accept, containerId, disabled, onDrop]);

  const dropProps = useCallback(() => ({
    onDragOver: (e: React.DragEvent) => handleDragOver(e),
    onDragLeave: handleDragLeave,
    onDrop: handleDrop,
    'data-drop-zone': containerId,
    style: {
      outline: isOver ? '2px dashed #6366f1' : 'none',
      outlineOffset: '-2px',
    } as React.CSSProperties,
  }), [handleDragOver, handleDragLeave, handleDrop, containerId, isOver]);

  return { dropProps, isOver, ref: elementRef };
}

// ─── useSortable ───────────────────────────────────────────────────────────────

export function useSortable<T>(options: UseSortableOptions<T>) {
  const { containerId, items, type, getId, onReorder, disabled = false } = options;

  const handleDrop = useCallback((result: DropResult) => {
    if (!result.item || result.containerId !== containerId) return;
    const fromIndex = items.findIndex(item => getId(item) === result.item.id);
    if (fromIndex === -1) return;
    const toIndex = Math.min(result.index, items.length - 1);
    if (fromIndex === toIndex) return;

    const newItems = [...items];
    const [moved] = newItems.splice(fromIndex, 1);
    newItems.splice(toIndex, 0, moved);
    onReorder(newItems, fromIndex, toIndex);
  }, [containerId, items, getId, onReorder]);

  const { dropProps, isOver } = useDropzone({
    containerId,
    accept: [type],
    onDrop: handleDrop,
    disabled,
  });

  const getSortableItemProps = useCallback((item: T, index: number) => {
    const itemId = getId(item);
    const draggable = useDraggable({
      id: itemId,
      type,
      data: item,
      containerId,
      index,
      disabled,
    });

    return {
      ...draggable.dragProps(),
      onDragOver: (e: React.DragEvent) => {
        e.preventDefault();
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const midY = rect.top + rect.height / 2;
        const dropIndex = e.clientY < midY ? index : index + 1;
        setGlobalDragState({
          dragOverContainerId: containerId,
          dragOverIndex: dropIndex,
          dropTarget: { containerId, index: dropIndex },
        });
      },
      isDragging: draggable.isDragging,
      isDropTarget: globalDragState.dragOverContainerId === containerId && globalDragState.dragOverIndex === index,
    };
  }, [containerId, type, getId, disabled]);

  return { dropProps, isOver, getSortableItemProps, items };
}

// ─── Global Drag State Hook ────────────────────────────────────────────────────

export function useDragState(): DragState {
  const [state, setState] = useState<DragState>(globalDragState);

  useEffect(() => {
    const update = () => setState({ ...globalDragState });
    listeners.add(update);
    return () => { listeners.delete(update); };
  }, []);

  return state;
}

// ─── Import React ──────────────────────────────────────────────────────────────
import React from 'react';

export default useDraggable;
