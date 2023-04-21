/*

https://github.com/Benibur/linked-list

       head node   (prepend)
           A
node.next  |     |  node.prev
                V
            tail node  (append)


 */

module.exports = (function () {
  /*
   * Constructor. Takes no arguments.
   */
  function DoublyLinkedList() {
    // pointer to first item
    this._head = null;
    // pointer to the last item
    this._tail = null;
    // length of list
    this._length = 0;
    // counter for nodes' ids
    this._counter = 0;
    return;
  }

  // Wraps data in a node object.
  DoublyLinkedList.prototype._createNewNode = function (data) {
    var node;
    node = {
      data: data,
      next: null,
      prev: null,
      id: this._counter,
    };
    this._counter++;
    return node;
  };

  /*
   * Appends a node to the end of the list, after the tail.
   */
  DoublyLinkedList.prototype.append = function (data) {
    var node;
    node = this._createNewNode(data);
    if (this._length === 0) {
      // first node, so all pointers to this
      this._head = node;
      this._tail = node;
    } else {
      // put on the tail
      this._tail.prev = node;
      node.next = this._tail;
      this._tail = node;
    }
    // update count
    this._length++;
    return node;
  };

  /*
   * Prepends a node to the start of the list, before the head.
   */

  DoublyLinkedList.prototype.prepend = function (data) {
    var node;
    if (this._head === null) {
      // list is empty, so this is the first node
      // use the same logic as append
      return this.append(data);
    } else {
      node = this._createNewNode(data);
      // place before head
      this._head.next = node;
      node.prev = this._head;
      this._head = node;
    }
    // update count
    this._length++;
    return node;
  };

  /*
   * Insert one node at rank.
   * Returns the new node, undefined if rank out of range.
   */
  DoublyLinkedList.prototype.insert = function (rank, data) {
    var next;
    var nodeToAdd;
    var target;
    if (this._length === 0) {
      if (rank !== 0) {
        return void 0;
      }
      return this.append(data);
    }
    if (rank === 0) {
      return this.prepend(data);
    }
    if (rank === this._length) {
      return this.append(data);
    }
    if (this._length < rank || rank < 0) {
      return void 0;
    }
    nodeToAdd = this._createNewNode(data);
    target = this.at(rank);
    if (target === void 0) {
      return void 0;
    }
    next = target.next;
    target.next = nodeToAdd;
    nodeToAdd.prev = target;
    nodeToAdd.next = next;
    next.prev = nodeToAdd;
    this._length++;
    return nodeToAdd;
  };

  /*
   * Insert a new node after one
   * Returns the new node
   */
  DoublyLinkedList.prototype.insertAfterNode = function (nextNode, data) {
    var nodeToAdd;
    var target;
    var prev;
    if (nextNode.prev === null) {
      return this.append(data);
    }
    nodeToAdd = this._createNewNode(data);
    target = nextNode;
    prev = target.prev;
    target.prev = nodeToAdd;
    nodeToAdd.next = target;
    nodeToAdd.prev = prev;
    prev.next = nodeToAdd;
    this._length++;
    return nodeToAdd;
  };

  /*
   * Returns the node at the specified index. The index starts at 0.
   * Undefined if index out of range.
   */
  DoublyLinkedList.prototype.at = function (index) {
    var node;
    if (index >= 0 && index < this._length) {
      node = this._head;
      while (index--) {
        node = node.prev;
      }
      return node;
    }
    return void 0;
  };

  /*
   * Returns the node with the specified id, undefined if wrong id.
   */
  DoublyLinkedList.prototype.id = function (id) {
    // var index
    var node;
    id = parseInt(id);
    // index = this._length
    node = this._head;
    while (node && node.id !== id) {
      node = node.prev;
    }
    if (node) {
      return node;
    } else {
      return void 0;
    }
  };

  /*
   * Returns the rank of a node, undefined if node not found
   */
  DoublyLinkedList.prototype.rank = function (node) {
    var currentNode;
    // var id
    // var index
    var rank;
    rank = 0;
    // id = parseInt(id)
    // index = this._length
    currentNode = this._head;
    do {
      if (currentNode === node) {
        return rank;
      }
      rank++;
      currentNode = currentNode.prev;
    } while (currentNode !== null);
    return void 0;
  };

  /*
   * Returns the node at the head of the list.
   */
  DoublyLinkedList.prototype.head = function () {
    return this._head;
  };

  /*
   * Returns the node at the tail of the list.
   */
  DoublyLinkedList.prototype.tail = function () {
    return this._tail;
  };

  /*
   * Returns the size of the list.
   */

  DoublyLinkedList.prototype.size = function () {
    return this._length;
  };

  /*
   * Removes the item at the index.
   * returns undefined if index out of range
   */
  DoublyLinkedList.prototype.remove = function (index) {
    var node;
    node = this.at(index);
    if (node === void 0) {
      return void 0;
    }
    return this.removeNode(node);
  };

  /*
   * Removes the item with this id
   * Returns undefined if id not in the chain
   */
  DoublyLinkedList.prototype.removeID = function (id) {
    var node;
    node = this.id(id);
    if (node === void 0) {
      return void 0;
    }
    return this.removeNode(node);
  };

  DoublyLinkedList.prototype.removeNode = function (node) {
    var next;
    var prev;
    if (this._length === 0) {
      return void 0;
    }
    if (this._length === 1) {
      if (node !== this._head) {
        return void 0;
      }
      this._head = null;
      this._tail = null;
      this._length = 0;
      return node;
    }

    // head and length > 1
    if (node === this._head) {
      this._head = node.prev;
      this._head.next = null;
      node.prev = null;
      this._length -= 1;
      return node;
    }

    // tail and length > 1
    if (node === this._tail) {
      this._tail = node.next;
      this._tail.prev = null;
      node.next = null;
      this._length -= 1;
      return node;
    }

    // node is in the middle of the list
    prev = node.prev;
    next = node.next;
    prev.next = next;
    next.prev = prev;
    node.prev = null;
    node.next = null;
    this._length -= 1;
    return node;
  };

  DoublyLinkedList.prototype.printIdChain = function () {
    var index;
    var node;
    var txt;
    node = this._head;
    if (node === null) {
      return "empty chain";
    }
    txt = [];
    index = this._length;
    while (index--) {
      txt.push(node.id);
      node = node.prev;
    }
    return txt.join("-");
  };

  DoublyLinkedList.prototype.printAllChain = function () {
    var index;
    var length;
    var node;
    var rk;
    var txt;
    node = this._head;
    if (node === null) {
      return "empty chain";
    }
    txt = [];
    index = this._length;
    length = this._length - 1;
    while (index--) {
      rk = length - index;
      txt.push(rk + " - id:" + node.id + " - data:" + JSON.stringify(node.data));
      node = node.prev;
    }
    return txt.join("\n");
  };

  DoublyLinkedList.prototype.printDataChain = function () {
    var index;
    var node;
    var txt;
    node = this._head;
    if (node === null) {
      return "empty chain";
    }
    txt = [];
    index = this._length;
    while (index--) {
      txt.push(node.data);
      node = node.prev;
    }
    return txt.join("-");
  };

  return DoublyLinkedList;
})();
