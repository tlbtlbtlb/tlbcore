# Coding style

## Exceptions

* Code is not expected to recover gracefully from memory allocation failure.


## Security

* When reading a binary structure over the network, be careful. Check that sizes are reasonable, using correct math.
* It's reasonable to impose arbitrary limits less than memory size when reading structures, like:
```C
  uint32_t size;
  p.get(size);
  if (!(size < 1000000)) throw runtime_error(stringprintf("Unreasonable size %lu", (u_long)size));
  if (size > p.remaining() / sizeof(T)) throw packet_rd_overrun_err(size*sizeof(T) - p.remaining());
```

