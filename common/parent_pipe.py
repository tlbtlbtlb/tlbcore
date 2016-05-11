import sys, ujson, traceback

class stdio_server(object):

    def __init__(self):
        pass

    def run(self):
        while True:
            msg = self.rx()
            if msg is None: break

            cmdReq = msg.get('cmdReq', None)
            if cmdReq is not None:
                try:
                    cmdFunc = getattr(self, 'cmd_' + cmdReq)
                    cmdFunc(*msg.get('cmdArgs', []))
                    continue
                except:
                    exctype, value, tb = sys.exc_info()
                    traceback.print_exception(exctype, value, tb, 10, sys.stderr)
                    continue

            rpcReq = msg.get('rpcReq', None)
            if rpcReq is not None:
                try:
                    reqFunc = getattr(self, 'req_' + rpcReq)
                    rpcRet = reqFunc(*msg.get('rpcArgs'))
                    self.tx({'rpcId': msg['rpcId'], 'rpcRet': rpcRet })
                    continue
                except:
                    exctype, value, tb = sys.exc_info()
                    traceback.print_exception(exctype, value, tb, 10, sys.stderr)
                    self.tx({'rpcId': msg['rpcId'], 'rpcRet': [str(exctype) + ': ' + str(value)] })
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
