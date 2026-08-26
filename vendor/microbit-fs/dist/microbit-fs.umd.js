var microbitFs = (() => {
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

  // vendor/microbit-fs/esm/micropython-fs-builder.js
  var micropython_fs_builder_exports = {};
  __export(micropython_fs_builder_exports, {
    addIntelHexFiles: () => addIntelHexFiles,
    calculateFileSize: () => calculateFileSize,
    createMpFsBuilderCache: () => createMpFsBuilderCache,
    generateHexWithFiles: () => generateHexWithFiles,
    getIntelHexFiles: () => getIntelHexFiles,
    getMemMapFsSize: () => getMemMapFsSize
  });

  // vendor/nrf-intel-hex/intel-hex.js
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

  // vendor/microbit-fs/esm/common.js
  function strToBytes(str) {
    const encoder = new TextEncoder();
    return encoder.encode(str);
  }
  function bytesToStr(byteArray) {
    const decoder = new TextDecoder();
    return decoder.decode(byteArray);
  }
  var concatUint8Array = (first, second) => {
    const combined = new Uint8Array(first.length + second.length);
    combined.set(first);
    combined.set(second, first.length);
    return combined;
  };
  var areUint8ArraysEqual = (first, second) => {
    if (first.length !== second.length)
      return false;
    for (let i = 0; i < first.length; i++) {
      if (first[i] !== second[i])
        return false;
    }
    return true;
  };

  // vendor/microbit-fs/esm/micropython-appended.js
  var AppendedBlock;
  (function(AppendedBlock2) {
    AppendedBlock2[AppendedBlock2["StartAdd"] = 253952] = "StartAdd";
    AppendedBlock2[AppendedBlock2["Length"] = 8192] = "Length";
    AppendedBlock2[AppendedBlock2["EndAdd"] = 262144] = "EndAdd";
  })(AppendedBlock || (AppendedBlock = {}));
  var AppendedHeader;
  (function(AppendedHeader2) {
    AppendedHeader2[AppendedHeader2["Byte0"] = 0] = "Byte0";
    AppendedHeader2[AppendedHeader2["Byte1"] = 1] = "Byte1";
    AppendedHeader2[AppendedHeader2["CodeLengthLsb"] = 2] = "CodeLengthLsb";
    AppendedHeader2[AppendedHeader2["CodeLengthMsb"] = 3] = "CodeLengthMsb";
    AppendedHeader2[AppendedHeader2["Length"] = 4] = "Length";
  })(AppendedHeader || (AppendedHeader = {}));
  var HEADER_START_BYTE_0 = 77;
  var HEADER_START_BYTE_1 = 80;
  var HEX_INSERTION_POINT = ":::::::::::::::::::::::::::::::::::::::::::\n";
  function cleanseOldHexFormat(intelHex) {
    return intelHex.replace(HEX_INSERTION_POINT, "");
  }
  function isAppendedScriptPresent(intelHex) {
    let intelHexMap;
    if (typeof intelHex === "string") {
      const intelHexClean = cleanseOldHexFormat(intelHex);
      intelHexMap = intel_hex_default.fromHex(intelHexClean);
    } else {
      intelHexMap = intelHex;
    }
    const headerMagic = intelHexMap.slicePad(AppendedBlock.StartAdd, 2, 255);
    return headerMagic[0] === HEADER_START_BYTE_0 && headerMagic[1] === HEADER_START_BYTE_1;
  }

  // vendor/microbit-fs/esm/hex-map-utils.js
  function getUint64(intelHexMap, address) {
    const uint64Data = intelHexMap.slicePad(address, 8, 255);
    return new DataView(uint64Data.buffer).getUint32(
      0,
      true
      /* little endian */
    );
  }
  function getUint32(intelHexMap, address) {
    const uint32Data = intelHexMap.slicePad(address, 4, 255);
    return new DataView(uint32Data.buffer).getUint32(
      0,
      true
      /* little endian */
    );
  }
  function getUint16(intelHexMap, address) {
    const uint16Data = intelHexMap.slicePad(address, 2, 255);
    return new DataView(uint16Data.buffer).getUint16(
      0,
      true
      /* little endian */
    );
  }
  function getUint8(intelHexMap, address) {
    const uint16Data = intelHexMap.slicePad(address, 1, 255);
    return uint16Data[0];
  }
  function getString(intelHexMap, address) {
    const memBlock = intelHexMap.slice(address).get(address);
    let iStrEnd = 0;
    while (iStrEnd < memBlock.length && memBlock[iStrEnd] !== 0)
      iStrEnd++;
    if (iStrEnd === memBlock.length) {
      return "";
    }
    const stringBytes = memBlock.slice(0, iStrEnd);
    return bytesToStr(stringBytes);
  }

  // vendor/microbit-fs/esm/flash-regions.js
  var RegionId;
  (function(RegionId2) {
    RegionId2[RegionId2["softDevice"] = 1] = "softDevice";
    RegionId2[RegionId2["microPython"] = 2] = "microPython";
    RegionId2[RegionId2["fs"] = 3] = "fs";
  })(RegionId || (RegionId = {}));
  var RegionHashType;
  (function(RegionHashType2) {
    RegionHashType2[RegionHashType2["empty"] = 0] = "empty";
    RegionHashType2[RegionHashType2["data"] = 1] = "data";
    RegionHashType2[RegionHashType2["pointer"] = 2] = "pointer";
  })(RegionHashType || (RegionHashType = {}));
  var MAGIC_1_LEN_BYTES = 4;
  var RegionHeaderOffset;
  (function(RegionHeaderOffset2) {
    RegionHeaderOffset2[RegionHeaderOffset2["magic2"] = 4] = "magic2";
    RegionHeaderOffset2[RegionHeaderOffset2["pageSizeLog2"] = 6] = "pageSizeLog2";
    RegionHeaderOffset2[RegionHeaderOffset2["regionCount"] = 8] = "regionCount";
    RegionHeaderOffset2[RegionHeaderOffset2["tableLength"] = 10] = "tableLength";
    RegionHeaderOffset2[RegionHeaderOffset2["version"] = 12] = "version";
    RegionHeaderOffset2[RegionHeaderOffset2["magic1"] = 16] = "magic1";
  })(RegionHeaderOffset || (RegionHeaderOffset = {}));
  var REGION_HEADER_MAGIC_1 = 1501507838;
  var REGION_HEADER_MAGIC_2 = 3249657757;
  var RegionRowOffset;
  (function(RegionRowOffset2) {
    RegionRowOffset2[RegionRowOffset2["hashData"] = 8] = "hashData";
    RegionRowOffset2[RegionRowOffset2["lengthBytes"] = 12] = "lengthBytes";
    RegionRowOffset2[RegionRowOffset2["startPage"] = 14] = "startPage";
    RegionRowOffset2[RegionRowOffset2["hashType"] = 15] = "hashType";
    RegionRowOffset2[RegionRowOffset2["id"] = 16] = "id";
  })(RegionRowOffset || (RegionRowOffset = {}));
  var REGION_ROW_LEN_BYTES = RegionRowOffset.id;
  function getTableHeader(iHexMap, pSize = 1024) {
    let endAddress = 0;
    const magic1ToFind = new Uint8Array(new Uint32Array([REGION_HEADER_MAGIC_1]).buffer);
    const magic2ToFind = new Uint8Array(new Uint32Array([REGION_HEADER_MAGIC_2]).buffer);
    const mapEntries = iHexMap.paginate(pSize, 255).entries();
    for (let iter = mapEntries.next(); !iter.done; iter = mapEntries.next()) {
      if (!iter.value)
        continue;
      const blockByteArray = iter.value[1];
      const subArrayMagic2 = blockByteArray.subarray(-RegionHeaderOffset.magic2);
      if (areUint8ArraysEqual(subArrayMagic2, magic2ToFind) && areUint8ArraysEqual(blockByteArray.subarray(-RegionHeaderOffset.magic1, -(RegionHeaderOffset.magic1 - MAGIC_1_LEN_BYTES)), magic1ToFind)) {
        const pageStartAddress = iter.value[0];
        endAddress = pageStartAddress + pSize;
        break;
      }
    }
    const version = getUint16(iHexMap, endAddress - RegionHeaderOffset.version);
    const tableLength = getUint16(iHexMap, endAddress - RegionHeaderOffset.tableLength);
    const regionCount = getUint16(iHexMap, endAddress - RegionHeaderOffset.regionCount);
    const pageSizeLog2 = getUint16(iHexMap, endAddress - RegionHeaderOffset.pageSizeLog2);
    const pageSize = Math.pow(2, pageSizeLog2);
    const startAddress = endAddress - RegionHeaderOffset.magic1;
    return {
      pageSizeLog2,
      pageSize,
      regionCount,
      tableLength,
      version,
      endAddress,
      startAddress
    };
  }
  function getRegionRow(iHexMap, rowEndAddress) {
    const id = getUint8(iHexMap, rowEndAddress - RegionRowOffset.id);
    const hashType = getUint8(iHexMap, rowEndAddress - RegionRowOffset.hashType);
    const hashData = getUint64(iHexMap, rowEndAddress - RegionRowOffset.hashData);
    let hashPointerData = "";
    if (hashType === RegionHashType.pointer) {
      hashPointerData = getString(iHexMap, hashData & 4294967295);
    }
    const startPage = getUint16(iHexMap, rowEndAddress - RegionRowOffset.startPage);
    const lengthBytes = getUint32(iHexMap, rowEndAddress - RegionRowOffset.lengthBytes);
    return {
      id,
      startPage,
      lengthBytes,
      hashType,
      hashData,
      hashPointerData
    };
  }
  function getHexMapFlashRegionsData(iHexMap) {
    const tableHeader = getTableHeader(iHexMap, 4096);
    const regionRows = {};
    for (let i = 0; i < tableHeader.regionCount; i++) {
      const rowEndAddress = tableHeader.startAddress - i * REGION_ROW_LEN_BYTES;
      const regionRow = getRegionRow(iHexMap, rowEndAddress);
      regionRows[regionRow.id] = regionRow;
    }
    if (!regionRows.hasOwnProperty(RegionId.microPython)) {
      throw new Error("Could not find a MicroPython region in the regions table.");
    }
    if (!regionRows.hasOwnProperty(RegionId.fs)) {
      throw new Error("Could not find a File System region in the regions table.");
    }
    const runtimeStartAddress = 0;
    let runtimeEndAddress = regionRows[RegionId.microPython].startPage * tableHeader.pageSize + regionRows[RegionId.microPython].lengthBytes;
    runtimeEndAddress = tableHeader.endAddress;
    const uPyVersion = regionRows[RegionId.microPython].hashPointerData;
    const fsStartAddress = regionRows[RegionId.fs].startPage * tableHeader.pageSize;
    const fsEndAddress = fsStartAddress + regionRows[RegionId.fs].lengthBytes;
    return {
      flashPageSize: tableHeader.pageSize,
      flashSize: 512 * 1024,
      flashStartAddress: 0,
      flashEndAddress: 512 * 1024,
      runtimeStartAddress,
      runtimeEndAddress,
      fsStartAddress,
      fsEndAddress,
      uPyVersion,
      deviceVersion: "V2"
    };
  }

  // vendor/microbit-fs/esm/uicr.js
  var DEVICE_INFO = [
    {
      deviceVersion: "V1",
      magicHeader: 401518716,
      flashSize: 256 * 1024,
      fsEnd: 256 * 1024
    },
    {
      deviceVersion: "V2",
      magicHeader: 1206825084,
      flashSize: 512 * 1024,
      fsEnd: 471040
    }
  ];
  var UICR_START = 268439552;
  var UICR_CUSTOMER_OFFSET = 128;
  var UICR_CUSTOMER_UPY_OFFSET = 64;
  var UICR_UPY_START = UICR_START + UICR_CUSTOMER_OFFSET + UICR_CUSTOMER_UPY_OFFSET;
  var UPY_MAGIC_LEN = 4;
  var UPY_END_MARKER_LEN = 4;
  var UPY_PAGE_SIZE_LEN = 4;
  var UPY_START_PAGE_LEN = 2;
  var UPY_PAGES_USED_LEN = 2;
  var UPY_DELIMITER_LEN = 4;
  var UPY_VERSION_LEN = 4;
  var UPY_REGIONS_TERMINATOR_LEN = 4;
  var MicropythonUicrAddress;
  (function(MicropythonUicrAddress2) {
    MicropythonUicrAddress2[MicropythonUicrAddress2["MagicValue"] = UICR_UPY_START] = "MagicValue";
    MicropythonUicrAddress2[MicropythonUicrAddress2["EndMarker"] = MicropythonUicrAddress2.MagicValue + UPY_MAGIC_LEN] = "EndMarker";
    MicropythonUicrAddress2[MicropythonUicrAddress2["PageSize"] = MicropythonUicrAddress2.EndMarker + UPY_END_MARKER_LEN] = "PageSize";
    MicropythonUicrAddress2[MicropythonUicrAddress2["StartPage"] = MicropythonUicrAddress2.PageSize + UPY_PAGE_SIZE_LEN] = "StartPage";
    MicropythonUicrAddress2[MicropythonUicrAddress2["PagesUsed"] = MicropythonUicrAddress2.StartPage + UPY_START_PAGE_LEN] = "PagesUsed";
    MicropythonUicrAddress2[MicropythonUicrAddress2["Delimiter"] = MicropythonUicrAddress2.PagesUsed + UPY_PAGES_USED_LEN] = "Delimiter";
    MicropythonUicrAddress2[MicropythonUicrAddress2["VersionLocation"] = MicropythonUicrAddress2.Delimiter + UPY_DELIMITER_LEN] = "VersionLocation";
    MicropythonUicrAddress2[MicropythonUicrAddress2["RegionsTerminator"] = MicropythonUicrAddress2.VersionLocation + UPY_REGIONS_TERMINATOR_LEN] = "RegionsTerminator";
    MicropythonUicrAddress2[MicropythonUicrAddress2["End"] = MicropythonUicrAddress2.RegionsTerminator + UPY_VERSION_LEN] = "End";
  })(MicropythonUicrAddress || (MicropythonUicrAddress = {}));
  function confirmMagicValue(intelHexMap) {
    const readMagicHeader = getMagicValue(intelHexMap);
    for (const device of DEVICE_INFO) {
      if (device.magicHeader === readMagicHeader) {
        return true;
      }
    }
    return false;
  }
  function getMagicValue(intelHexMap) {
    return getUint32(intelHexMap, MicropythonUicrAddress.MagicValue);
  }
  function getDeviceVersion(intelHexMap) {
    const readMagicHeader = getMagicValue(intelHexMap);
    for (const device of DEVICE_INFO) {
      if (device.magicHeader === readMagicHeader) {
        return device.deviceVersion;
      }
    }
    throw new Error("Cannot find device version, unknown UICR Magic value");
  }
  function getFlashSize(intelHexMap) {
    const readMagicHeader = getMagicValue(intelHexMap);
    for (const device of DEVICE_INFO) {
      if (device.magicHeader === readMagicHeader) {
        return device.flashSize;
      }
    }
    throw new Error("Cannot find flash size, unknown UICR Magic value");
  }
  function getFsEndAddress(intelHexMap) {
    const readMagicHeader = getMagicValue(intelHexMap);
    for (const device of DEVICE_INFO) {
      if (device.magicHeader === readMagicHeader) {
        return device.fsEnd;
      }
    }
    throw new Error("Cannot find fs end address, unknown UICR Magic value");
  }
  function getPageSize(intelHexMap) {
    const pageSize = getUint32(intelHexMap, MicropythonUicrAddress.PageSize);
    return Math.pow(2, pageSize);
  }
  function getStartPage(intelHexMap) {
    return getUint16(intelHexMap, MicropythonUicrAddress.StartPage);
  }
  function getPagesUsed(intelHexMap) {
    return getUint16(intelHexMap, MicropythonUicrAddress.PagesUsed);
  }
  function getVersionLocation(intelHexMap) {
    return getUint32(intelHexMap, MicropythonUicrAddress.VersionLocation);
  }
  function getHexMapUicrData(intelHexMap) {
    const uicrMap = intelHexMap.slice(UICR_UPY_START);
    if (!confirmMagicValue(uicrMap)) {
      throw new Error("Could not find valid MicroPython UICR data.");
    }
    const flashPageSize = getPageSize(uicrMap);
    const flashSize = getFlashSize(uicrMap);
    const startPage = getStartPage(uicrMap);
    const flashStartAddress = startPage * flashPageSize;
    const flashEndAddress = flashStartAddress + flashSize;
    const pagesUsed = getPagesUsed(uicrMap);
    const runtimeEndAddress = pagesUsed * flashPageSize;
    const versionAddress = getVersionLocation(uicrMap);
    const uPyVersion = getString(intelHexMap, versionAddress);
    const deviceVersion = getDeviceVersion(uicrMap);
    const fsEndAddress = getFsEndAddress(uicrMap);
    return {
      flashPageSize,
      flashSize,
      flashStartAddress,
      flashEndAddress,
      runtimeStartAddress: flashStartAddress,
      runtimeEndAddress,
      fsStartAddress: runtimeEndAddress,
      fsEndAddress,
      uicrStartAddress: MicropythonUicrAddress.MagicValue,
      uicrEndAddress: MicropythonUicrAddress.End,
      uPyVersion,
      deviceVersion
    };
  }

  // vendor/microbit-fs/esm/hex-mem-info.js
  function getHexMapDeviceMemInfo(intelHexMap) {
    let errorMsg = "";
    try {
      return getHexMapUicrData(intelHexMap);
    } catch (err) {
      errorMsg += err.message + "\n";
    }
    try {
      return getHexMapFlashRegionsData(intelHexMap);
    } catch (err) {
      throw new Error(errorMsg + err.message);
    }
  }

  // vendor/microbit-fs/esm/micropython-fs-builder.js
  var ChunkMarker;
  (function(ChunkMarker2) {
    ChunkMarker2[ChunkMarker2["Freed"] = 0] = "Freed";
    ChunkMarker2[ChunkMarker2["PersistentData"] = 253] = "PersistentData";
    ChunkMarker2[ChunkMarker2["FileStart"] = 254] = "FileStart";
    ChunkMarker2[ChunkMarker2["Unused"] = 255] = "Unused";
  })(ChunkMarker || (ChunkMarker = {}));
  var ChunkFormatIndex;
  (function(ChunkFormatIndex2) {
    ChunkFormatIndex2[ChunkFormatIndex2["Marker"] = 0] = "Marker";
    ChunkFormatIndex2[ChunkFormatIndex2["EndOffset"] = 1] = "EndOffset";
    ChunkFormatIndex2[ChunkFormatIndex2["NameLength"] = 2] = "NameLength";
    ChunkFormatIndex2[ChunkFormatIndex2["Tail"] = 127] = "Tail";
  })(ChunkFormatIndex || (ChunkFormatIndex = {}));
  var CHUNK_LEN = 128;
  var CHUNK_MARKER_LEN = 1;
  var CHUNK_TAIL_LEN = 1;
  var CHUNK_DATA_LEN = CHUNK_LEN - CHUNK_MARKER_LEN - CHUNK_TAIL_LEN;
  var CHUNK_HEADER_END_OFFSET_LEN = 1;
  var CHUNK_HEADER_NAME_LEN = 1;
  var MAX_FILENAME_LENGTH = 120;
  var MAX_NUMBER_OF_CHUNKS = 256 - 4;
  function createMpFsBuilderCache(originalIntelHex) {
    const originalMemMap = intel_hex_default.fromHex(originalIntelHex);
    const deviceMem = getHexMapDeviceMemInfo(originalMemMap);
    const uPyIntelHex = originalMemMap.slice(deviceMem.runtimeStartAddress, deviceMem.runtimeEndAddress - deviceMem.runtimeStartAddress).asHexString().replace(":00000001FF", "");
    return {
      originalIntelHex,
      originalMemMap,
      uPyIntelHex,
      uPyEndAddress: deviceMem.runtimeEndAddress,
      fsSize: getMemMapFsSize(originalMemMap)
    };
  }
  function getFreeChunks(intelHexMap) {
    const freeChunks = [];
    const startAddress = getStartAddress(intelHexMap);
    const endAddress = getLastPageAddress(intelHexMap);
    let chunkAddr = startAddress;
    let chunkIndex = 1;
    while (chunkAddr < endAddress) {
      const marker = intelHexMap.slicePad(chunkAddr, 1, ChunkMarker.Unused)[0];
      if (marker === ChunkMarker.Unused || marker === ChunkMarker.Freed) {
        freeChunks.push(chunkIndex);
      }
      chunkIndex++;
      chunkAddr += CHUNK_LEN;
    }
    return freeChunks;
  }
  function getStartAddress(intelHexMap) {
    const deviceMem = getHexMapDeviceMemInfo(intelHexMap);
    const fsMaxSize = CHUNK_LEN * MAX_NUMBER_OF_CHUNKS;
    const startAddressForMaxFs = getEndAddress(intelHexMap) - fsMaxSize;
    const startAddress = Math.max(deviceMem.fsStartAddress, startAddressForMaxFs);
    if (startAddress % deviceMem.flashPageSize) {
      throw new Error("File system start address from UICR does not align with flash page size.");
    }
    return startAddress;
  }
  function getEndAddress(intelHexMap) {
    const deviceMem = getHexMapDeviceMemInfo(intelHexMap);
    let endAddress = deviceMem.fsEndAddress;
    if (deviceMem.deviceVersion === "V1") {
      if (isAppendedScriptPresent(intelHexMap)) {
        endAddress = AppendedBlock.StartAdd;
      }
      endAddress -= deviceMem.flashPageSize;
    }
    return endAddress;
  }
  function getLastPageAddress(intelHexMap) {
    const deviceMem = getHexMapDeviceMemInfo(intelHexMap);
    return getEndAddress(intelHexMap) - deviceMem.flashPageSize;
  }
  function setPersistentPage(intelHexMap) {
    intelHexMap.set(getLastPageAddress(intelHexMap), new Uint8Array([ChunkMarker.PersistentData]));
  }
  function chuckIndexAddress(intelHexMap, chunkIndex) {
    return getStartAddress(intelHexMap) + (chunkIndex - 1) * CHUNK_LEN;
  }
  var FsFile = class {
    /**
     * Create a file.
     *
     * @param filename - Name for the file.
     * @param data - Byte array with the file data.
     */
    constructor(filename, data) {
      Object.defineProperty(this, "_filename", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "_filenameBytes", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "_dataBytes", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      Object.defineProperty(this, "_fsDataBytes", {
        enumerable: true,
        configurable: true,
        writable: true,
        value: void 0
      });
      this._filename = filename;
      this._filenameBytes = strToBytes(filename);
      if (this._filenameBytes.length > MAX_FILENAME_LENGTH) {
        throw new Error(`File name "${filename}" is too long (max ${MAX_FILENAME_LENGTH} characters).`);
      }
      this._dataBytes = data;
      const fileHeader = this._generateFileHeaderBytes();
      this._fsDataBytes = new Uint8Array(fileHeader.length + this._dataBytes.length + 1);
      this._fsDataBytes.set(fileHeader, 0);
      this._fsDataBytes.set(this._dataBytes, fileHeader.length);
      this._fsDataBytes[this._fsDataBytes.length - 1] = 255;
    }
    /**
     * Generate an array of file system chunks for all this file content.
     *
     * @throws {Error} When there are not enough chunks available.
     *
     * @param freeChunks - List of available chunks to use.
     * @returns An array of byte arrays, one item per chunk.
     */
    getFsChunks(freeChunks) {
      const chunks = [];
      let freeChunksIndex = 0;
      let dataIndex = 0;
      let chunk = new Uint8Array(CHUNK_LEN).fill(255);
      chunk[ChunkFormatIndex.Marker] = ChunkMarker.FileStart;
      let loopEnd = Math.min(this._fsDataBytes.length, CHUNK_DATA_LEN);
      for (let i = 0; i < loopEnd; i++, dataIndex++) {
        chunk[CHUNK_MARKER_LEN + i] = this._fsDataBytes[dataIndex];
      }
      chunks.push(chunk);
      while (dataIndex < this._fsDataBytes.length) {
        freeChunksIndex++;
        if (freeChunksIndex >= freeChunks.length) {
          throw new Error(`Not enough space for the ${this._filename} file.`);
        }
        const previousChunk = chunks[chunks.length - 1];
        previousChunk[ChunkFormatIndex.Tail] = freeChunks[freeChunksIndex];
        chunk = new Uint8Array(CHUNK_LEN).fill(255);
        chunk[ChunkFormatIndex.Marker] = freeChunks[freeChunksIndex - 1];
        loopEnd = Math.min(this._fsDataBytes.length - dataIndex, CHUNK_DATA_LEN);
        for (let i = 0; i < loopEnd; i++, dataIndex++) {
          chunk[CHUNK_MARKER_LEN + i] = this._fsDataBytes[dataIndex];
        }
        chunks.push(chunk);
      }
      return chunks;
    }
    /**
     * Generate a single byte array with the filesystem data for this file.
     *
     * @param freeChunks - List of available chunks to use.
     * @returns A byte array with the data to go straight into flash.
     */
    getFsBytes(freeChunks) {
      const chunks = this.getFsChunks(freeChunks);
      const chunksLen = chunks.length * CHUNK_LEN;
      const fileFsBytes = new Uint8Array(chunksLen);
      for (let i = 0; i < chunks.length; i++) {
        fileFsBytes.set(chunks[i], CHUNK_LEN * i);
      }
      return fileFsBytes;
    }
    /**
     * @returns Size, in bytes, of how much space the file takes in the filesystem
     *     flash memory.
     */
    getFsFileSize() {
      const chunksUsed = Math.ceil(this._fsDataBytes.length / CHUNK_DATA_LEN);
      return chunksUsed * CHUNK_LEN;
    }
    /**
     * Generates a byte array for the file header as expected by the MicroPython
     * file system.
     *
     * @return Byte array with the header data.
     */
    _generateFileHeaderBytes() {
      const headerSize = CHUNK_HEADER_END_OFFSET_LEN + CHUNK_HEADER_NAME_LEN + this._filenameBytes.length;
      const endOffset = (headerSize + this._dataBytes.length) % CHUNK_DATA_LEN;
      const fileNameOffset = headerSize - this._filenameBytes.length;
      const headerBytes = new Uint8Array(headerSize);
      headerBytes[ChunkFormatIndex.EndOffset - 1] = endOffset;
      headerBytes[ChunkFormatIndex.NameLength - 1] = this._filenameBytes.length;
      for (let i = fileNameOffset; i < headerSize; ++i) {
        headerBytes[i] = this._filenameBytes[i - fileNameOffset];
      }
      return headerBytes;
    }
  };
  function calculateFileSize(filename, data) {
    const file = new FsFile(filename, data);
    return file.getFsFileSize();
  }
  function addMemMapFile(intelHexMap, filename, data) {
    if (!filename)
      throw new Error("File has to have a file name.");
    if (!data.length)
      throw new Error(`File ${filename} has to contain data.`);
    const freeChunks = getFreeChunks(intelHexMap);
    if (freeChunks.length === 0) {
      throw new Error("There is no storage space left.");
    }
    const chunksStartAddress = chuckIndexAddress(intelHexMap, freeChunks[0]);
    const fsFile = new FsFile(filename, data);
    const fileFsBytes = fsFile.getFsBytes(freeChunks);
    intelHexMap.set(chunksStartAddress, fileFsBytes);
    setPersistentPage(intelHexMap);
  }
  function addIntelHexFiles(intelHex, files, returnBytes = false) {
    let intelHexMap;
    if (typeof intelHex === "string") {
      intelHexMap = intel_hex_default.fromHex(intelHex);
    } else {
      intelHexMap = intelHex.clone();
    }
    const deviceMem = getHexMapDeviceMemInfo(intelHexMap);
    Object.keys(files).forEach((filename) => {
      addMemMapFile(intelHexMap, filename, files[filename]);
    });
    return returnBytes ? intelHexMap.slicePad(0, deviceMem.flashSize) : intelHexMap.asHexString() + "\n";
  }
  function generateHexWithFiles(cache, files) {
    const memMapWithFiles = cache.originalMemMap.clone();
    Object.keys(files).forEach((filename) => {
      addMemMapFile(memMapWithFiles, filename, files[filename]);
    });
    return cache.uPyIntelHex + memMapWithFiles.slice(cache.uPyEndAddress).asHexString() + "\n";
  }
  function getIntelHexFiles(intelHex) {
    let hexMap;
    if (typeof intelHex === "string") {
      hexMap = intel_hex_default.fromHex(intelHex);
    } else {
      hexMap = intelHex.clone();
    }
    const startAddress = getStartAddress(hexMap);
    const endAddress = getLastPageAddress(hexMap);
    const usedChunks = {};
    const startChunkIndexes = [];
    let chunkAddr = startAddress;
    let chunkIndex = 1;
    while (chunkAddr < endAddress) {
      const chunk = hexMap.slicePad(chunkAddr, CHUNK_LEN, ChunkMarker.Unused);
      const marker = chunk[0];
      if (marker !== ChunkMarker.Unused && marker !== ChunkMarker.Freed && marker !== ChunkMarker.PersistentData) {
        usedChunks[chunkIndex] = chunk;
        if (marker === ChunkMarker.FileStart) {
          startChunkIndexes.push(chunkIndex);
        }
      }
      chunkIndex++;
      chunkAddr += CHUNK_LEN;
    }
    const files = {};
    for (const startChunkIndex of startChunkIndexes) {
      const startChunk = usedChunks[startChunkIndex];
      const endChunkOffset = startChunk[ChunkFormatIndex.EndOffset];
      const filenameLen = startChunk[ChunkFormatIndex.NameLength];
      let chunkDataStart = 3 + filenameLen;
      const filename = bytesToStr(startChunk.slice(3, chunkDataStart));
      if (files.hasOwnProperty(filename)) {
        throw new Error(`Found multiple files named: ${filename}.`);
      }
      files[filename] = new Uint8Array(0);
      let currentChunk = startChunk;
      let currentIndex = startChunkIndex;
      let iterations = Object.keys(usedChunks).length + 1;
      while (iterations--) {
        const nextIndex = currentChunk[ChunkFormatIndex.Tail];
        if (nextIndex === ChunkMarker.Unused) {
          files[filename] = concatUint8Array(files[filename], currentChunk.slice(chunkDataStart, 1 + endChunkOffset));
          break;
        } else {
          files[filename] = concatUint8Array(files[filename], currentChunk.slice(chunkDataStart, ChunkFormatIndex.Tail));
        }
        const nextChunk = usedChunks[nextIndex];
        if (!nextChunk) {
          throw new Error(`Chunk ${currentIndex} points to unused index ${nextIndex}.`);
        }
        if (nextChunk[ChunkFormatIndex.Marker] !== currentIndex) {
          throw new Error(`Chunk index ${nextIndex} did not link to previous chunk index ${currentIndex}.`);
        }
        currentChunk = nextChunk;
        currentIndex = nextIndex;
        chunkDataStart = 1;
      }
      if (iterations <= 0) {
        throw new Error("Malformed file chunks did not link correctly.");
      }
    }
    return files;
  }
  function getMemMapFsSize(intelHexMap) {
    const deviceMem = getHexMapDeviceMemInfo(intelHexMap);
    const startAddress = getStartAddress(intelHexMap);
    const endAddress = getEndAddress(intelHexMap);
    return endAddress - startAddress - deviceMem.flashPageSize;
  }
  return __toCommonJS(micropython_fs_builder_exports);
})();
