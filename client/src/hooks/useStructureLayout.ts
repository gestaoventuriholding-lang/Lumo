import { useCallback, useEffect, useRef, useState } from "react";
import {
  appendMovementLog,
  loadStructureLayout,
  saveStructureLayout,
} from "@/lib/structureStorage";
import { syncDeskCounter } from "@/lib/structureFactory";
import type { StructureElement, StructureLayout, StructureSlot } from "@/types/structure";

const SAVE_DELAY_MS = 400;
const MAX_HISTORY = 50;
const MAX_UNDO = 40;

export function useStructureLayout() {
  const [layout, setLayout] = useState<StructureLayout>(() => {
    const loaded = loadStructureLayout();
    syncDeskCounter(loaded.elements);
    return loaded;
  });
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoStack = useRef<StructureLayout[]>([]);
  const redoStack = useRef<StructureLayout[]>([]);

  useEffect(() => {
    const loaded = loadStructureLayout();
    syncDeskCounter(loaded.elements);
    setLayout(loaded);
  }, []);

  const syncUndoState = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  const persist = useCallback((next: StructureLayout) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveStructureLayout(next);
    }, SAVE_DELAY_MS);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const commit = useCallback(
    (updater: (prev: StructureLayout) => StructureLayout, logMessage?: string) => {
      setLayout((prev) => {
        undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), prev];
        redoStack.current = [];
        syncUndoState();

        let next = updater(prev);
        if (logMessage) {
          const entry = appendMovementLog(next, logMessage);
          next = { ...next, history: [entry, ...prev.history].slice(0, MAX_HISTORY) };
        }
        next = { ...next, updatedAt: new Date().toISOString() };
        persist(next);
        return next;
      });
    },
    [persist, syncUndoState]
  );

  const updateElement = useCallback(
    (id: string, patch: Partial<StructureElement>, skipUndo = false) => {
      if (skipUndo) {
        setLayout((prev) => {
          const next = {
            ...prev,
            elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
            updatedAt: new Date().toISOString(),
          };
          persist(next);
          return next;
        });
        return;
      }
      commit((prev) => ({
        ...prev,
        elements: prev.elements.map((el) => (el.id === id ? { ...el, ...patch } : el)),
      }));
    },
    [commit, persist]
  );

  /** Aplica vários ajustes de uma vez (um único passo no desfazer, a menos que seja arraste ao vivo) */
  const updateElements = useCallback(
    (patches: Array<{ id: string; patch: Partial<StructureElement> }>, skipUndo = false) => {
      if (patches.length === 0) return;
      const apply = (prev: StructureLayout): StructureLayout => {
        const byId = new Map(patches.map((item) => [item.id, item.patch]));
        return {
          ...prev,
          elements: prev.elements.map((el) => (byId.has(el.id) ? { ...el, ...byId.get(el.id) } : el)),
        };
      };
      if (skipUndo) {
        setLayout((prev) => {
          const next = { ...apply(prev), updatedAt: new Date().toISOString() };
          persist(next);
          return next;
        });
        return;
      }
      commit(apply);
    },
    [commit, persist]
  );

  const addElements = useCallback(
    (items: StructureElement[]) => {
      if (items.length === 0) return;
      commit(
        (prev) => ({ ...prev, elements: [...prev.elements, ...items] }),
        items.length === 1 ? `${items[0].label} adicionado ao layout` : `${items.length} elementos adicionados ao layout`
      );
    },
    [commit]
  );

  const removeElements = useCallback(
    (ids: string[]) => {
      if (ids.length === 0) return;
      commit(
        (prev) => ({ ...prev, elements: prev.elements.filter((el) => !ids.includes(el.id)) }),
        ids.length === 1 ? undefined : `${ids.length} elementos removidos`
      );
    },
    [commit]
  );

  const addElement = useCallback(
    (element: StructureElement) => {
      commit(
        (prev) => ({ ...prev, elements: [...prev.elements, element] }),
        `${element.label} adicionado ao layout`
      );
    },
    [commit]
  );

  const removeElement = useCallback(
    (id: string) => {
      commit((prev) => {
        const removed = prev.elements.find((el) => el.id === id);
        const elements = prev.elements.filter((el) => el.id !== id);
        if (removed) {
          const entry = appendMovementLog({ ...prev, elements }, `${removed.label} removido`);
          return {
            ...prev,
            elements,
            history: [entry, ...prev.history].slice(0, MAX_HISTORY),
          };
        }
        return { ...prev, elements };
      });
    },
    [commit]
  );

  const undo = useCallback(() => {
    setLayout((current) => {
      const previous = undoStack.current.pop();
      if (!previous) return current;
      redoStack.current.push(current);
      syncUndoState();
      const next = { ...previous, updatedAt: new Date().toISOString() };
      persist(next);
      syncDeskCounter(next.elements);
      return next;
    });
  }, [persist, syncUndoState]);

  const redo = useCallback(() => {
    setLayout((current) => {
      const nextState = redoStack.current.pop();
      if (!nextState) return current;
      undoStack.current.push(current);
      syncUndoState();
      const next = { ...nextState, updatedAt: new Date().toISOString() };
      persist(next);
      syncDeskCounter(next.elements);
      return next;
    });
  }, [persist, syncUndoState]);

  const saveNow = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveStructureLayout(layout);
  }, [layout]);

  const pushUndoSnapshot = useCallback(
    (snapshot: StructureLayout) => {
      undoStack.current = [...undoStack.current.slice(-(MAX_UNDO - 1)), snapshot];
      redoStack.current = [];
      syncUndoState();
    },
    [syncUndoState]
  );

  return {
    layout,
    canUndo,
    canRedo,
    updateElement,
    updateElements,
    addElements,
    removeElements,
    addElement,
    removeElement,
    undo,
    redo,
    saveNow,
    pushUndoSnapshot,
  };
};
