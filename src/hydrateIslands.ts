import { type ComponentType, h, hydrate } from 'preact';
import { createRootFragment } from 'preact-root-fragment';

export function hydrateIslands(
  islands: { id: string; Component: ComponentType; props: Record<string, unknown> }[],
) {
  const startCommentNodes = new Map<string, Node>();
  const endCommentNodes = new Map<string, Node>();
  const commentIslands = new Map(islands.map((island) => [island.id, island]));
  const treeWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_COMMENT);
  while (treeWalker.nextNode()) {
    const value = treeWalker.currentNode.nodeValue;
    if (value !== null) {
      if (value.startsWith('/')) {
        const island = commentIslands.get(value.slice(1));
        if (island !== undefined) {
          endCommentNodes.set(island.id, treeWalker.currentNode);
        }
      } else {
        const island = commentIslands.get(value);
        if (island !== undefined) {
          startCommentNodes.set(island.id, treeWalker.currentNode);
        }
      }
    }
  }
  for (const { id, Component, props } of islands) {
    const startCommentNode = startCommentNodes.get(id);
    if (startCommentNode === undefined) {
      throw new Error(`Could not find start comment node for island ${id}`);
    }
    const endCommentNode = endCommentNodes.get(id);
    if (endCommentNode === undefined) {
      throw new Error(`Could not find end comment node for island ${id}`);
    }
    const parent = startCommentNode.parentNode;
    if (parent === null) {
      throw new Error(`Could not find parent node for island ${id}`);
    }
    let sibling = startCommentNode.nextSibling;
    const nodes = new Array<Node>();
    while (sibling !== endCommentNode) {
      if (sibling === null) {
        throw new Error(`Could not find end comment node for island ${id}`);
      }
      nodes.push(sibling);
      sibling = sibling.nextSibling;
    }
    const fragment = createRootFragment(parent, nodes);
    hydrate(h(Component, props), fragment);
  }
}

export const moduleUrl = import.meta.url;
