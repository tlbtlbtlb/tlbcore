import sys, ujson, traceback

class StdioServer(object):

    def __init__(self):
        self.pipein = sys.stdin
        self.pipeout = sys.stdout
        sys.stdout = sys.stderr   # so print works

    def run(self):
        while True:
            msg = self.rx()
            if msg is None: break

            method = msg.get('method', None)
            if method is not None:
                try:
                    methodFunc = getattr(self, 'rpc_' + method)
                    result = methodFunc(*msg.get('params'))
                    self.tx({'id': msg['id'], 'result': result, 'error': None})
                    continue
                except:
                    exctype, value, tb = sys.exc_info()
                    traceback.print_exception(exctype, value, tb, 10, sys.stderr)
                    self.tx({'id': msg['id'], 'error': str(exctype) + ': ' + str(value) })
                    continue
    def rpc_handshake(self):
        return 'handshake'

    def rx(self):
        rx_line = self.pipein.readline()
        if len(rx_line) == 0: return None # EOF
        msg = ujson.decode(rx_line)
        return msg

    def tx(self, msg):
        tx_line = ujson.encode(msg, escape_forward_slashes=False)
        self.pipeout.write(tx_line)
        self.pipeout.write('\n')
        self.pipeout.flush()
