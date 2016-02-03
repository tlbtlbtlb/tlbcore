#!/usr/local/bin/python
import optparse

__all__ = []

parser=optparse.OptionParser("Usage: %prog [-options]")

parser.set_conflict_handler('resolve')

options=None
args=None

def add_option(*args, **kws):
    parser.add_option(*args, **kws)

def set_defaults(**kws):
    parser.set_defaults(**kws)

def parse():
    global options, args
    if options is None:
        options, args = parser.parse_args()

        #print "options=",options

add_option('-v', '--verbose',
           action='store_true', dest='verbose',
           help="Verbose")
