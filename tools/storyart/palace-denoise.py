"""BlenderとTBBを共有しない別プロセスで、線形HDRのレンダーノイズを除く。"""
import argparse
import ctypes
import sys
from pathlib import Path

import numpy as np


def main():
    p=argparse.ArgumentParser()
    p.add_argument('--oidn-path',required=True)
    p.add_argument('--input',required=True)
    p.add_argument('--output',required=True)
    args=p.parse_args()
    root=Path(args.oidn_path).resolve()
    sys.path.insert(0,str(root))
    for lib in root.glob('oidn/lib.linux.x64/libtbb.so.*'):
        ctypes.CDLL(str(lib),mode=ctypes.RTLD_GLOBAL)
    import oidn
    color=np.ascontiguousarray(np.load(args.input),dtype=np.float32)
    h,w,channels=color.shape
    if channels!=3 or not np.isfinite(color).all():
        raise ValueError('入力は有限なRGB画像であること')
    output=np.empty_like(color)
    device=oidn.NewDevice()
    filt=None
    try:
        oidn.CommitDevice(device)
        filt=oidn.NewFilter(device,'RT')
        oidn.SetSharedFilterImage(filt,'color',color,oidn.FORMAT_FLOAT3,w,h)
        oidn.SetSharedFilterImage(filt,'output',output,oidn.FORMAT_FLOAT3,w,h)
        set_bool=oidn.__lib_oidn.oidnSetFilter1b
        set_bool.argtypes=[ctypes.c_void_p,ctypes.c_char_p,ctypes.c_bool]
        set_bool.restype=None
        set_bool(filt,b'hdr',True)
        oidn.CommitFilter(filt)
        oidn.ExecuteFilter(filt)
        error=oidn.GetDeviceError(device)
        if error:
            raise RuntimeError('OIDNのエラー: '+str(error))
        np.save(args.output,output)
    finally:
        if filt:
            oidn.ReleaseFilter(filt)
        oidn.ReleaseDevice(device)


if __name__=='__main__':
    main()
