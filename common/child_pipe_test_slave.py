import parent_pipe


class TestServer(parent_pipe.StdioServer):
    """
    These are used in test_child_pipe.js
    """
    def rpc_test1(self, v):
        return v+1

    def rpc_test2(self, a, b, c):
        assert a == 'abc'
        assert b == 'def'
        assert c['ghi'] == 'jkl'
        return [a, b, c], 'foo'

    def rpc_testerr(self):
        raise ValueError('testerr always raises this error')

if __name__ == '__main__':
    ts = TestServer()
    ts.run()
