import sys, ujson

class stdio_server(object):

    def __init__(self):
        pass

    def run(self):
        while True:
            msg = self.rx()
            if msg is None: break

            cmdReq = msg.get('cmdReq', None)
            if cmdReq is not None:
                cmdFunc = getattr(self, 'cmd_' + cmdReq)
                cmdFunc(*msg.get('cmdArgs', []))
                continue

            rpcReq = msg.get('rpcReq', None)
            if rpcReq is not None:
                reqFunc = getattr(self, 'req_' + rpcReq)
                rpcRet = reqFunc(*msg.get('rpcArgs'))
                self.tx({'rpcId': msg['rpcId'], 'rpcRet': rpcRet })
                continue

    def rx(self):
        rx_line = sys.stdin.readline()
        if len(rx_line) == 0: return None # EOF
        msg = ujson.decode(rx_line)
        return msg

    def cmd(self, cmdReq, *cmdArgs):
        self.tx({ 'cmdReq': cmdReq, 'cmdArgs': cmdArgs })

    def tx(self, msg):
        tx_line = ujson.encode(msg, escape_forward_slashes=False)
        sys.stdout.write(tx_line)
        sys.stdout.write('\n')
        sys.stdout.flush()
