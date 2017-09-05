#include "./jswrapbase.h"
#include "./nodeasync.h"
#include <uv.h>

void asyncCallbacksSet(AsyncCallbacks &it, string const &eventName, uv_loop_t *loop, Local< Value > _onMessage);
