import parent_pipe


class TestServer(parent_pipe.StdioServer):
    def rpc_test1(self, v):
        return v+1

    def rpc_testerr(self):
        raise ValueError('testerr always raises this error')

if __name__ == '__main__':
    ts = TestServer()
    ts.run()
