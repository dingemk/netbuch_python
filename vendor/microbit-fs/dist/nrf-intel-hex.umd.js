var nrfIntelHex = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // vendor/nrf-intel-hex/intel-hex.js
  var intel_hex_exports = {};
  __export(intel_hex_exports, {
    default: () => intel_hex_default
  });
  var hexLineRegexp = /:([0-9A-Fa-f]{8,})([0-9A-Fa-f]{2})(?:\r\n|\r|\n|)/g;
  function checksum(bytes) {
    return -bytes.reduce((sum, v) => sum + v, 0) & 255;
  }
  function checksumTwo(array1, array2) {
    const partial1 = array1.reduce((sum, v) => sum + v, 0);
    const partial2 = array2.reduce((sum, v) => sum + v, 0);
    return -(partial1 + partial2) & 255;
  }
  function hexpad(number) {
    return number.toString(16).toUpperCase().padStart(2, "0");
  }
  Number.isInteger = Number.isInteger || function(value) {
    return typeof value === "number" && isFinite(value) && Math.floor(value) === value;
  };
  var MemoryMap = class _MemoryMap {
    /**
     * @param {Iterable} blocks The initial value for the memory blocks inside this
     * <tt>MemoryMap</tt>. All keys must be numeric, and all values must be instances of
     * <tt>Uint8Array</tt>. Optionally it can also be a plain <tt>Object</tt> with
     * only numeric keys.
     */
    constructor(blocks) {
      this._blocks = /* @__PURE__ */ new Map();
      if (blocks && typeof blocks[Symbol.iterator] === "function") {
        for (const tuple of blocks) {
          if (!(tuple instanceof Array) || tuple.length !== 2) {
            throw new Error("First parameter to MemoryMap constructor must be an iterable of [addr, bytes] or undefined");
          }
          this.set(tuple[0], tuple[1]);
        }
      } else if (typeof blocks === "object") {
        const addrs = Object.keys(blocks);
        for (const addr of addrs) {
          this.set(parseInt(addr), blocks[addr]);
        }
      } else if (blocks !== void 0 && blocks !== null) {
        throw new Error("First parameter to MemoryMap constructor must be an iterable of [addr, bytes] or undefined");
      }
    }
    set(addr, value) {
      if (!Number.isInteger(addr)) {
        throw new Error("Address passed to MemoryMap is not an integer");
      }
      if (addr < 0) {
        throw new Error("Address passed to MemoryMap is negative");
      }
      if (!(value instanceof Uint8Array)) {
        throw new Error("Bytes passed to MemoryMap are not an Uint8Array");
      }
      return this._blocks.set(addr, value);
    }
    // Delegate the following to the 'this._blocks' Map:
    get(addr) {
      return this._blocks.get(addr);
    }
    clear() {
      return this._blocks.clear();
    }
    delete(addr) {
      return this._blocks.delete(addr);
    }
    entries() {
      return this._blocks.entries();
    }
    forEach(callback, that) {
      return this._blocks.forEach(callback, that);
    }
    has(addr) {
      return this._blocks.has(addr);
    }
    keys() {
      return this._blocks.keys();
    }
    values() {
      return this._blocks.values();
    }
    get size() {
      return this._blocks.size;
    }
    [Symbol.iterator]() {
      return this._blocks[Symbol.iterator]();
    }
    /**
     * Parses a string containing data formatted in "Intel HEX" format, and
     * returns an instance of {@linkcode MemoryMap}.
     *<br/>
     * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
     * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
     * will be ordered in ascending order.
     *<br/>
     * The parser has an opinionated behaviour, and will throw a descriptive error if it
     * encounters some malformed input. Check the project's
     * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
     *<br/>
     * If <tt>maxBlockSize</tt> is given, any contiguous data block larger than that will
     * be split in several blocks.
     *
     * @param {String} hexText The contents of a .hex file.
     * @param {Number} [maxBlockSize=Infinity] Maximum size of the returned <tt>Uint8Array</tt>s.
     *
     * @return {MemoryMap}
     *
     * @example
     * import MemoryMap from 'nrf-intel-hex';
     *
     * let intelHexString =
     *     ":100000000102030405060708090A0B0C0D0E0F1068\n" +
     *     ":00000001FF";
     *
     * let memMap = MemoryMap.fromHex(intelHexString);
     *
     * for (let [address, dataBlock] of memMap) {
     *     console.log('Data block at ', address, ', bytes: ', dataBlock);
     * }
     */
    static fromHex(hexText, maxBlockSize = Infinity) {
      const blocks = new _MemoryMap();
      let lastCharacterParsed = 0;
      let matchResult;
      let recordCount = 0;
      let ulba = 0;
      hexLineRegexp.lastIndex = 0;
      while ((matchResult = hexLineRegexp.exec(hexText)) !== null) {
        recordCount++;
        if (lastCharacterParsed !== matchResult.index) {
          throw new Error(
            "Malformed hex file: Could not parse between characters " + lastCharacterParsed + " and " + matchResult.index + ' ("' + hexText.substring(lastCharacterParsed, Math.min(matchResult.index, lastCharacterParsed + 16)).trim() + '")'
          );
        }
        lastCharacterParsed = hexLineRegexp.lastIndex;
        const [, recordStr, recordChecksum] = matchResult;
        const recordBytes = new Uint8Array(recordStr.match(/[\da-f]{2}/gi).map((h) => parseInt(h, 16)));
        const recordLength = recordBytes[0];
        if (recordLength + 4 !== recordBytes.length) {
          throw new Error("Mismatched record length at record " + recordCount + " (" + matchResult[0].trim() + "), expected " + recordLength + " data bytes but actual length is " + (recordBytes.length - 4));
        }
        const cs = checksum(recordBytes);
        if (parseInt(recordChecksum, 16) !== cs) {
          throw new Error("Checksum failed at record " + recordCount + " (" + matchResult[0].trim() + "), should be " + cs.toString(16));
        }
        const offset = (recordBytes[1] << 8) + recordBytes[2];
        const recordType = recordBytes[3];
        const data = recordBytes.subarray(4);
        if (recordType === 0) {
          if (blocks.has(ulba + offset)) {
            throw new Error("Duplicated data at record " + recordCount + " (" + matchResult[0].trim() + ")");
          }
          if (offset + data.length > 65536) {
            throw new Error(
              "Data at record " + recordCount + " (" + matchResult[0].trim() + ") wraps over 0xFFFF. This would trigger ambiguous behaviour. Please restructure your data so that for every record the data offset plus the data length do not exceed 0xFFFF."
            );
          }
          blocks.set(ulba + offset, data);
        } else {
          if (offset !== 0) {
            throw new Error("Record " + recordCount + " (" + matchResult[0].trim() + ") must have 0000 as data offset.");
          }
          switch (recordType) {
            case 1:
              if (lastCharacterParsed !== hexText.length) {
                throw new Error("There is data after an EOF record at record " + recordCount);
              }
              return blocks.join(maxBlockSize);
            case 2:
              ulba = (data[0] << 8) + data[1] << 4;
              break;
            case 3:
              break;
            case 4:
              ulba = (data[0] << 8) + data[1] << 16;
              break;
            case 5:
              break;
            default:
              throw new Error("Invalid record type 0x" + hexpad(recordType) + " at record " + recordCount + " (should be between 0x00 and 0x05)");
          }
        }
      }
      if (recordCount) {
        throw new Error("No EOF record at end of file");
      } else {
        throw new Error("Malformed .hex file, could not parse any registers");
      }
    }
    /**
     * Returns a <strong>new</strong> instance of {@linkcode MemoryMap}, containing
     * the same data, but concatenating together those memory blocks that are adjacent.
     *<br/>
     * The insertion order of keys in the {@linkcode MemoryMap} is guaranteed to be strictly
     * ascending. In other words, when iterating through the {@linkcode MemoryMap}, the addresses
     * will be ordered in ascending order.
     *<br/>
     * If <tt>maxBlockSize</tt> is given, blocks will be concatenated together only
     * until the joined block reaches this size in bytes. This means that the output
     * {@linkcode MemoryMap} might have more entries than the input one.
     *<br/>
     * If there is any overlap between blocks, an error will be thrown.
     *<br/>
     * The returned {@linkcode MemoryMap} will use newly allocated memory.
     *
     * @param {Number} [maxBlockSize=Infinity] Maximum size of the <tt>Uint8Array</tt>s in the
     * returned {@linkcode MemoryMap}.
     *
     * @return {MemoryMap}
     */
    join(maxBlockSize = Infinity) {
      const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b);
      const blockSizes = /* @__PURE__ */ new Map();
      let lastBlockAddr = -1;
      let lastBlockEndAddr = -1;
      for (let i = 0, l = sortedKeys.length; i < l; i++) {
        const blockAddr = sortedKeys[i];
        const blockLength = this.get(sortedKeys[i]).length;
        if (lastBlockEndAddr === blockAddr && lastBlockEndAddr - lastBlockAddr < maxBlockSize) {
          blockSizes.set(lastBlockAddr, blockSizes.get(lastBlockAddr) + blockLength);
          lastBlockEndAddr += blockLength;
        } else if (lastBlockEndAddr <= blockAddr) {
          blockSizes.set(blockAddr, blockLength);
          lastBlockAddr = blockAddr;
          lastBlockEndAddr = blockAddr + blockLength;
        } else {
          throw new Error("Overlapping data around address 0x" + blockAddr.toString(16));
        }
      }
      const mergedBlocks = new _MemoryMap();
      let mergingBlock;
      let mergingBlockAddr = -1;
      for (let i = 0, l = sortedKeys.length; i < l; i++) {
        const blockAddr = sortedKeys[i];
        if (blockSizes.has(blockAddr)) {
          mergingBlock = new Uint8Array(blockSizes.get(blockAddr));
          mergedBlocks.set(blockAddr, mergingBlock);
          mergingBlockAddr = blockAddr;
        }
        mergingBlock.set(this.get(blockAddr), blockAddr - mergingBlockAddr);
      }
      return mergedBlocks;
    }
    /**
     * Given a {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Map|<tt>Map</tt>}
     * of {@linkcode MemoryMap}s, indexed by a alphanumeric ID,
     * returns a <tt>Map</tt> of address to tuples (<tt>Arrays</tt>s of length 2) of the form
     * <tt>(id, Uint8Array)</tt>s.
     *<br/>
     * The scenario for using this is having several {@linkcode MemoryMap}s, from several calls to
     * {@link module:nrf-intel-hex~hexToArrays|hexToArrays}, each having a different identifier.
     * This function locates where those memory block sets overlap, and returns a <tt>Map</tt>
     * containing addresses as keys, and arrays as values. Each array will contain 1 or more
     * <tt>(id, Uint8Array)</tt> tuples: the identifier of the memory block set that has
     * data in that region, and the data itself. When memory block sets overlap, there will
     * be more than one tuple.
     *<br/>
     * The <tt>Uint8Array</tt>s in the output are
     * {@link https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/TypedArray/subarray|subarrays}
     * of the input data; new memory is <strong>not</strong> allocated for them.
     *<br/>
     * The insertion order of keys in the output <tt>Map</tt> is guaranteed to be strictly
     * ascending. In other words, when iterating through the <tt>Map</tt>, the addresses
     * will be ordered in ascending order.
     *<br/>
     * When two blocks overlap, the corresponding array of tuples will have the tuples ordered
     * in the insertion order of the input <tt>Map</tt> of block sets.
     *<br/>
     *
     * @param {Map.MemoryMap} memoryMaps The input memory block sets
     *
     * @example
     * import MemoryMap from 'nrf-intel-hex';
     *
     * let memMap1 = MemoryMap.fromHex( hexdata1 );
     * let memMap2 = MemoryMap.fromHex( hexdata2 );
     * let memMap3 = MemoryMap.fromHex( hexdata3 );
     *
     * let maps = new Map([
     *  ['file A', blocks1],
     *  ['file B', blocks2],
     *  ['file C', blocks3]
     * ]);
     *
     * let overlappings = MemoryMap.overlapMemoryMaps(maps);
     *
     * for (let [address, tuples] of overlappings) {
     *     // if 'tuples' has length > 1, there is an overlap starting at 'address'
     *
     *     for (let [address, tuples] of overlappings) {
     *         let [id, bytes] = tuple;
     *         // 'id' in this example is either 'file A', 'file B' or 'file C'
     *     }
     * }
     * @return {Map.Array<mixed,Uint8Array>} The map of possibly overlapping memory blocks
     */
    static overlapMemoryMaps(memoryMaps) {
      const cuts = /* @__PURE__ */ new Set();
      for (const [, blocks] of memoryMaps) {
        for (const [address, block] of blocks) {
          cuts.add(address);
          cuts.add(address + block.length);
        }
      }
      const orderedCuts = Array.from(cuts.values()).sort((a, b) => a - b);
      const overlaps = /* @__PURE__ */ new Map();
      for (let i = 0, l = orderedCuts.length - 1; i < l; i++) {
        const cut = orderedCuts[i];
        const nextCut = orderedCuts[i + 1];
        const tuples = [];
        for (const [setId, blocks] of memoryMaps) {
          const blockAddr = Array.from(blocks.keys()).reduce((acc, val) => {
            if (val > cut) {
              return acc;
            }
            return Math.max(acc, val);
          }, -1);
          if (blockAddr !== -1) {
            const block = blocks.get(blockAddr);
            const subBlockStart = cut - blockAddr;
            const subBlockEnd = nextCut - blockAddr;
            if (subBlockStart < block.length) {
              tuples.push([setId, block.subarray(subBlockStart, subBlockEnd)]);
            }
          }
        }
        if (tuples.length) {
          overlaps.set(cut, tuples);
        }
      }
      return overlaps;
    }
    /**
     * Given the output of the {@linkcode MemoryMap.overlapMemoryMaps|overlapMemoryMaps}
     * (a <tt>Map</tt> of address to an <tt>Array</tt> of <tt>(id, Uint8Array)</tt> tuples),
     * returns a {@linkcode MemoryMap}. This discards the IDs in the process.
     *<br/>
     * The output <tt>Map</tt> contains as many entries as the input one (using the same addresses
     * as keys), but the value for each entry will be the <tt>Uint8Array</tt> of the <b>last</b>
     * tuple for each address in the input data.
     *<br/>
     * The scenario is wanting to join together several parsed .hex files, not worrying about
     * their overlaps.
     *<br/>
     *
     * @param {Map.Array<mixed,Uint8Array>} overlaps The (possibly overlapping) input memory blocks
     * @return {MemoryMap} The flattened memory blocks
     */
    static flattenOverlaps(overlaps) {
      return new _MemoryMap(
        Array.from(overlaps.entries()).map(([address, tuples]) => {
          return [address, tuples[tuples.length - 1][1]];
        })
      );
    }
    /**
     * Returns a new instance of {@linkcode MemoryMap}, where:
     *
     * <ul>
     *  <li>Each key (the start address of each <tt>Uint8Array</tt>) is a multiple of
     *    <tt>pageSize</tt></li>
     *  <li>The size of each <tt>Uint8Array</tt> is exactly <tt>pageSize</tt></li>
     *  <li>Bytes from the input map to bytes in the output</li>
     *  <li>Bytes not in the input are replaced by a padding value</li>
     * </ul>
     *<br/>
     * The scenario is wanting to prepare pages of bytes for a write operation, where the write
     * operation affects a whole page/sector at once.
     *<br/>
     * The insertion order of keys in the output {@linkcode MemoryMap} is guaranteed
     * to be strictly ascending. In other words, when iterating through the
     * {@linkcode MemoryMap}, the addresses will be ordered in ascending order.
     *<br/>
     * The <tt>Uint8Array</tt>s in the output will be newly allocated.
     *<br/>
     *
     * @param {Number} [pageSize=1024] The size of the output pages, in bytes
     * @param {Number} [pad=0xFF] The byte value to use for padding
     * @return {MemoryMap}
     */
    paginate(pageSize = 1024, pad = 255) {
      if (pageSize <= 0) {
        throw new Error("Page size must be greater than zero");
      }
      const outPages = new _MemoryMap();
      let page;
      const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b);
      for (let i = 0, l = sortedKeys.length; i < l; i++) {
        const blockAddr = sortedKeys[i];
        const block = this.get(blockAddr);
        const blockLength = block.length;
        const blockEnd = blockAddr + blockLength;
        for (let pageAddr = blockAddr - blockAddr % pageSize; pageAddr < blockEnd; pageAddr += pageSize) {
          page = outPages.get(pageAddr);
          if (!page) {
            page = new Uint8Array(pageSize);
            page.fill(pad);
            outPages.set(pageAddr, page);
          }
          const offset = pageAddr - blockAddr;
          let subBlock;
          if (offset <= 0) {
            subBlock = block.subarray(0, Math.min(pageSize + offset, blockLength));
            page.set(subBlock, -offset);
          } else {
            subBlock = block.subarray(offset, offset + Math.min(pageSize, blockLength - offset));
            page.set(subBlock, 0);
          }
        }
      }
      return outPages;
    }
    /**
     * Locates the <tt>Uint8Array</tt> which contains the given offset,
     * and returns the four bytes held at that offset, as a 32-bit unsigned integer.
     *
     *<br/>
     * Behaviour is similar to {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|DataView.prototype.getUint32},
     * except that this operates over a {@linkcode MemoryMap} instead of
     * over an <tt>ArrayBuffer</tt>, and that this may return <tt>undefined</tt> if
     * the address is not <em>entirely</em> contained within one of the <tt>Uint8Array</tt>s.
     *<br/>
     *
     * @param {Number} offset The memory offset to read the data
     * @param {Boolean} [littleEndian=false] Whether to fetch the 4 bytes as a little- or big-endian integer
     * @return {Number|undefined} An unsigned 32-bit integer number
     */
    getUint32(offset, littleEndian) {
      const keys = Array.from(this.keys());
      for (let i = 0, l = keys.length; i < l; i++) {
        const blockAddr = keys[i];
        const block = this.get(blockAddr);
        const blockLength = block.length;
        const blockEnd = blockAddr + blockLength;
        if (blockAddr <= offset && offset + 4 <= blockEnd) {
          return new DataView(block.buffer, offset - blockAddr, 4).getUint32(0, littleEndian);
        }
      }
      return;
    }
    /**
     * Returns a <tt>String</tt> of text representing a .hex file.
     * <br/>
     * The writer has an opinionated behaviour. Check the project's
     * {@link https://github.com/NordicSemiconductor/nrf-intel-hex#Features|README file} for details.
     *
     * @param {Number} [lineSize=16] Maximum number of bytes to be encoded in each data record.
     * Must have a value between 1 and 255, as per the specification.
     *
     * @return {String} String of text with the .hex representation of the input binary data
     *
     * @example
     * import MemoryMap from 'nrf-intel-hex';
     *
     * let memMap = new MemoryMap();
     * let bytes = new Uint8Array(....);
     * memMap.set(0x0FF80000, bytes); // The block with 'bytes' will start at offset 0x0FF80000
     *
     * let string = memMap.asHexString();
     */
    asHexString(lineSize = 16) {
      let lowAddress = 0;
      let highAddress = -1 << 16;
      const records = [];
      if (lineSize <= 0) {
        throw new Error("Size of record must be greater than zero");
      } else if (lineSize > 255) {
        throw new Error("Size of record must be less than 256");
      }
      const offsetRecord = new Uint8Array(6);
      const recordHeader = new Uint8Array(4);
      const sortedKeys = Array.from(this.keys()).sort((a, b) => a - b);
      for (let i = 0, l = sortedKeys.length; i < l; i++) {
        const blockAddr = sortedKeys[i];
        const block = this.get(blockAddr);
        if (!(block instanceof Uint8Array)) {
          throw new Error("Block at offset " + blockAddr + " is not an Uint8Array");
        }
        if (blockAddr < 0) {
          throw new Error("Block at offset " + blockAddr + " has a negative thus invalid address");
        }
        const blockSize = block.length;
        if (!blockSize) {
          continue;
        }
        if (blockAddr > highAddress + 65535) {
          highAddress = blockAddr - blockAddr % 65536;
          lowAddress = 0;
          offsetRecord[0] = 2;
          offsetRecord[1] = 0;
          offsetRecord[2] = 0;
          offsetRecord[3] = 4;
          offsetRecord[4] = highAddress >> 24;
          offsetRecord[5] = highAddress >> 16;
          records.push(
            ":" + Array.prototype.map.call(offsetRecord, hexpad).join("") + hexpad(checksum(offsetRecord))
          );
        }
        if (blockAddr < highAddress + lowAddress) {
          throw new Error(
            "Block starting at 0x" + blockAddr.toString(16) + " overlaps with a previous block."
          );
        }
        lowAddress = blockAddr % 65536;
        let blockOffset = 0;
        const blockEnd = blockAddr + blockSize;
        if (blockEnd > 4294967295) {
          throw new Error("Data cannot be over 0xFFFFFFFF");
        }
        while (highAddress + lowAddress < blockEnd) {
          if (lowAddress > 65535) {
            highAddress += 1 << 16;
            lowAddress = 0;
            offsetRecord[0] = 2;
            offsetRecord[1] = 0;
            offsetRecord[2] = 0;
            offsetRecord[3] = 4;
            offsetRecord[4] = highAddress >> 24;
            offsetRecord[5] = highAddress >> 16;
            records.push(
              ":" + Array.prototype.map.call(offsetRecord, hexpad).join("") + hexpad(checksum(offsetRecord))
            );
          }
          let recordSize = -1;
          while (lowAddress < 65536 && recordSize) {
            recordSize = Math.min(
              lineSize,
              // Normal case
              blockEnd - highAddress - lowAddress,
              // End of block
              65536 - lowAddress
              // End of low addresses
            );
            if (recordSize) {
              recordHeader[0] = recordSize;
              recordHeader[1] = lowAddress >> 8;
              recordHeader[2] = lowAddress;
              recordHeader[3] = 0;
              const subBlock = block.subarray(blockOffset, blockOffset + recordSize);
              records.push(
                ":" + Array.prototype.map.call(recordHeader, hexpad).join("") + Array.prototype.map.call(subBlock, hexpad).join("") + hexpad(checksumTwo(recordHeader, subBlock))
              );
              blockOffset += recordSize;
              lowAddress += recordSize;
            }
          }
        }
      }
      records.push(":00000001FF");
      return records.join("\n");
    }
    /**
     * Performs a deep copy of the current {@linkcode MemoryMap}, returning a new one
     * with exactly the same contents, but allocating new memory for each of its
     * <tt>Uint8Array</tt>s.
     *
     * @return {MemoryMap}
     */
    clone() {
      const cloned = new _MemoryMap();
      for (let [addr, value] of this) {
        cloned.set(addr, new Uint8Array(value));
      }
      return cloned;
    }
    /**
     * Given one <tt>Uint8Array</tt>, looks through its contents and returns a new
     * {@linkcode MemoryMap}, stripping away those regions where there are only
     * padding bytes.
     * <br/>
     * The start of the input <tt>Uint8Array</tt> is assumed to be offset zero for the output.
     * <br/>
     * The use case here is dumping memory from a working device and try to see the
     * "interesting" memory regions it has. This assumes that there is a constant,
     * predefined padding byte value being used in the "non-interesting" regions.
     * In other words: this will work as long as the dump comes from a flash memory
     * which has been previously erased (thus <tt>0xFF</tt>s for padding), or from a
     * previously blanked HDD (thus <tt>0x00</tt>s for padding).
     * <br/>
     * This method uses <tt>subarray</tt> on the input data, and thus does not allocate memory
     * for the <tt>Uint8Array</tt>s.
     *
     * @param {Uint8Array} bytes The input data
     * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
     * @param {Number} [minPadLength=64] The minimum number of consecutive pad bytes to
     * be considered actual padding
     *
     * @return {MemoryMap}
     */
    static fromPaddedUint8Array(bytes, padByte = 255, minPadLength = 64) {
      if (!(bytes instanceof Uint8Array)) {
        throw new Error("Bytes passed to fromPaddedUint8Array are not an Uint8Array");
      }
      const memMap = new _MemoryMap();
      let consecutivePads = 0;
      let lastNonPad = -1;
      let firstNonPad = 0;
      let skippingBytes = false;
      const l = bytes.length;
      for (let addr = 0; addr < l; addr++) {
        const byte = bytes[addr];
        if (byte === padByte) {
          consecutivePads++;
          if (consecutivePads >= minPadLength) {
            if (lastNonPad !== -1) {
              memMap.set(firstNonPad, bytes.subarray(firstNonPad, lastNonPad + 1));
            }
            skippingBytes = true;
          }
        } else {
          if (skippingBytes) {
            skippingBytes = false;
            firstNonPad = addr;
          }
          lastNonPad = addr;
          consecutivePads = 0;
        }
      }
      if (!skippingBytes && lastNonPad !== -1) {
        memMap.set(firstNonPad, bytes.subarray(firstNonPad, l));
      }
      return memMap;
    }
    /**
     * Returns a new instance of {@linkcode MemoryMap}, containing only data between
     * the addresses <tt>address</tt> and <tt>address + length</tt>.
     * Behaviour is similar to {@linkcode https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Array/slice|Array.prototype.slice},
     * in that the return value is a portion of the current {@linkcode MemoryMap}.
     *
     * <br/>
     * The returned {@linkcode MemoryMap} might be empty.
     *
     * <br/>
     * Internally, this uses <tt>subarray</tt>, so new memory is not allocated.
     *
     * @param {Number} address The start address of the slice
     * @param {Number} length The length of memory map to slice out
     * @return {MemoryMap}
     */
    slice(address, length = Infinity) {
      if (length < 0) {
        throw new Error("Length of the slice cannot be negative");
      }
      const sliced = new _MemoryMap();
      for (let [blockAddr, block] of this) {
        const blockLength = block.length;
        if (blockAddr + blockLength >= address && blockAddr < address + length) {
          const sliceStart = Math.max(address, blockAddr);
          const sliceEnd = Math.min(address + length, blockAddr + blockLength);
          const sliceLength = sliceEnd - sliceStart;
          const relativeSliceStart = sliceStart - blockAddr;
          if (sliceLength > 0) {
            sliced.set(sliceStart, block.subarray(relativeSliceStart, relativeSliceStart + sliceLength));
          }
        }
      }
      return sliced;
    }
    /**
     * Returns a new instance of {@linkcode https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/DataView/getUint32|Uint8Array}, containing only data between
     * the addresses <tt>address</tt> and <tt>address + length</tt>. Any byte without a value
     * in the input {@linkcode MemoryMap} will have a value of <tt>padByte</tt>.
     *
     * <br/>
     * This method allocates new memory.
     *
     * @param {Number} address The start address of the slice
     * @param {Number} length The length of memory map to slice out
     * @param {Number} [padByte=0xFF] The value of the byte assumed to be used as padding
     * @return {Uint8Array}
     */
    slicePad(address, length, padByte = 255) {
      if (length < 0) {
        throw new Error("Length of the slice cannot be negative");
      }
      const out = new Uint8Array(length).fill(padByte);
      for (let [blockAddr, block] of this) {
        const blockLength = block.length;
        if (blockAddr + blockLength >= address && blockAddr < address + length) {
          const sliceStart = Math.max(address, blockAddr);
          const sliceEnd = Math.min(address + length, blockAddr + blockLength);
          const sliceLength = sliceEnd - sliceStart;
          const relativeSliceStart = sliceStart - blockAddr;
          if (sliceLength > 0) {
            out.set(block.subarray(relativeSliceStart, relativeSliceStart + sliceLength), sliceStart - address);
          }
        }
      }
      return out;
    }
    /**
     * Checks whether the current memory map contains the one given as a parameter.
     *
     * <br/>
     * "Contains" means that all the offsets that have a byte value in the given
     * memory map have a value in the current memory map, and that the byte values
     * are the same.
     *
     * <br/>
     * An empty memory map is always contained in any other memory map.
     *
     * <br/>
     * Returns boolean <tt>true</tt> if the memory map is contained, <tt>false</tt>
     * otherwise.
     *
     * @param {MemoryMap} memMap The memory map to check
     * @return {Boolean}
     */
    contains(memMap) {
      for (let [blockAddr, block] of memMap) {
        const blockLength = block.length;
        const slice = this.slice(blockAddr, blockLength).join().get(blockAddr);
        if (!slice || slice.length !== blockLength) {
          return false;
        }
        for (const i in block) {
          if (block[i] !== slice[i]) {
            return false;
          }
        }
      }
      return true;
    }
  };
  var intel_hex_default = MemoryMap;
  return __toCommonJS(intel_hex_exports);
})();
