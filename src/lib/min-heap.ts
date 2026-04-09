export interface HeapNode {
  index: number;
  cost: number;
}

export class MinHeap {
  private readonly nodes: HeapNode[] = [];

  get size() {
    return this.nodes.length;
  }

  push(index: number, cost: number) {
    this.nodes.push({ index, cost });
    this.bubbleUp(this.nodes.length - 1);
  }

  pop() {
    const first = this.nodes[0];

    if (!first) {
      return null;
    }

    const last = this.nodes.pop();

    if (this.nodes.length > 0 && last) {
      this.nodes[0] = last;
      this.sinkDown(0);
    }

    return first;
  }

  private bubbleUp(startIndex: number) {
    let nodeIndex = startIndex;

    while (nodeIndex > 0) {
      const parentIndex = Math.floor((nodeIndex - 1) / 2);

      if (this.nodes[parentIndex].cost <= this.nodes[nodeIndex].cost) {
        break;
      }

      swap(this.nodes, nodeIndex, parentIndex);
      nodeIndex = parentIndex;
    }
  }

  private sinkDown(startIndex: number) {
    let nodeIndex = startIndex;

    while (true) {
      const leftIndex = nodeIndex * 2 + 1;
      const rightIndex = leftIndex + 1;
      let smallestIndex = nodeIndex;

      if (
        leftIndex < this.nodes.length &&
        this.nodes[leftIndex].cost < this.nodes[smallestIndex].cost
      ) {
        smallestIndex = leftIndex;
      }

      if (
        rightIndex < this.nodes.length &&
        this.nodes[rightIndex].cost < this.nodes[smallestIndex].cost
      ) {
        smallestIndex = rightIndex;
      }

      if (smallestIndex === nodeIndex) {
        break;
      }

      swap(this.nodes, nodeIndex, smallestIndex);
      nodeIndex = smallestIndex;
    }
  }
}

function swap<TValue>(values: TValue[], leftIndex: number, rightIndex: number) {
  [values[leftIndex], values[rightIndex]] = [
    values[rightIndex],
    values[leftIndex],
  ];
}
