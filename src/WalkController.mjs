import {
  BranchNode,
  ExtensionNode,
  LeafNode,
  PrioritizedTaskExecutor,
} from "@ethereumjs/trie";

// NOTE: See for details on why we forked this
// https://github.com/ethereumjs/ethereumjs-monorepo/issues/2856

export async function newWalk(onNode, trie, root, level) {
  const strategy = new WalkController(onNode, trie, 500);
  await strategy.startWalk(root, level);
}

export class WalkController {
  constructor(onNode, trie, poolSize) {
    this.onNode = onNode;
    this.taskExecutor = new PrioritizedTaskExecutor(poolSize);
    this.trie = trie;
    this.resolve = () => {};
    this.reject = () => {};
  }

  async startWalk(root, level) {
    return new Promise(async (resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
      let node;
      try {
        node = await this.trie.lookupNode(root);
      } catch (error) {
        return this.reject(error);
      }
      this.processNode(root, node, [], level);
    });
  }

  allChildren(node, key = [], level) {
    if (node instanceof LeafNode) {
      return;
    }
    let children;
    if (node instanceof ExtensionNode) {
      children = [[node.key(), node.value()]];
    } else if (node instanceof BranchNode) {
      children = node.getChildren().map((b) => [[b[0]], b[1]]);
    }
    if (!children) {
      return;
    }
    for (const child of children) {
      const keyExtension = child[0];
      const childRef = child[1];
      const childKey = key.concat(keyExtension);
      const priority = childKey.length;
      this.pushNodeToQueue(childRef, childKey, priority, level);
    }
  }

  pushNodeToQueue(nodeRef, key = [], priority, level) {
    this.taskExecutor.executeOrQueue(
      priority ?? key.length,
      async (taskFinishedCallback) => {
        let childNode;
        try {
          childNode = await this.trie.lookupNode(nodeRef);
        } catch (error) {
          return this.reject(error);
        }
        taskFinishedCallback();
        this.processNode(nodeRef, childNode, key, level);
      }
    );
  }

  processNode(nodeRef, node, key = [], level) {
    this.onNode(nodeRef, node, key, this, level);
    if (this.taskExecutor.finished()) {
      // onNode should schedule new tasks. If no tasks was added and the queue is empty, then we have finished our walk.
      this.resolve();
    }
  }
}
