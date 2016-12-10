import math, random

cookie_rng = random.SystemRandom() # initialized from /dev/urandom
def mkid(l=15):
    return ''.join([cookie_rng.choice('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz') for i in range(l)])
