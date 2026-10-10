// 街の施設の情景の原画の台帳 — tools/townart/build.py が書く。手で直さない。
// 鍵は townart.js の vignetteCanvas の鍵 (tavern / inn / shrine)。null の間は従来のドット絵を出す。
// focus = 切り取りの中心 / lights = 揺らぐ明かり [{at:[x,y], r, tone}] (どれも原画の幅・高さに対する割合。r は高さに対する半径)
// <<TOWN_KEYART>>
export const TOWN_KEYART = {
  tavern: {"src": "./art/town/tavern.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.5032552083333334, 0.21484375], "r": 0.06, "tone": "lamp"}, {"at": [0.935546875, 0.5234375], "r": 0.085, "tone": "fire"}, {"at": [0.5423177083333334, 0.5986328125], "r": 0.025, "tone": "candle"}, {"at": [0.7109375, 0.2734375], "r": 0.023, "tone": "lamp"}, {"at": [0.9029947916666666, 0.2333984375], "r": 0.023, "tone": "candle"}]},
  inn: {"src": "./art/town/inn.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.7200520833333334, 0.3212890625], "r": 0.026, "tone": "candle"}]},
  shrine: {"src": "./art/town/shrine.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.5, 0.302734375], "r": 0.073, "tone": "crystal"}, {"at": [0.3151041666666667, 0.4013671875], "r": 0.028, "tone": "candle"}, {"at": [0.6790364583333334, 0.40234375], "r": 0.028, "tone": "candle"}]},
  palace: {"src": "./art/town/palace.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.3190104166666667, 0.392578125], "r": 0.06, "tone": "fire"}, {"at": [0.6673177083333334, 0.392578125], "r": 0.06, "tone": "fire"}, {"at": [0.08723958333333333, 0.330078125], "r": 0.023, "tone": "candle"}, {"at": [0.9049479166666666, 0.349609375], "r": 0.026, "tone": "candle"}, {"at": [0.21549479166666666, 0.47265625], "r": 0.024, "tone": "candle"}]},
  mansion: {"src": "./art/town/mansion.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.7473958333333334, 0.61328125], "r": 0.026, "tone": "candle"}, {"at": [0.7799479166666666, 0.578125], "r": 0.026, "tone": "candle"}, {"at": [0.6171875, 0.4287109375], "r": 0.019, "tone": "candle"}, {"at": [0.8951822916666666, 0.666015625], "r": 0.055, "tone": "soul"}, {"at": [0.8841145833333334, 0.1357421875], "r": 0.03, "tone": "lamp"}]},
  shop: {"src": "./art/town/shop.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.20833333333333334, 0.5107421875], "r": 0.026, "tone": "candle"}, {"at": [0.8639322916666666, 0.1748046875], "r": 0.045, "tone": "lamp"}]},
  altar: {"src": "./art/town/altar.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.4986979166666667, 0.365234375], "r": 0.07, "tone": "soul"}, {"at": [0.23372395833333334, 0.3232421875], "r": 0.025, "tone": "candle"}, {"at": [0.7682291666666666, 0.3232421875], "r": 0.025, "tone": "candle"}]},
  party: {"src": "./art/town/party.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.0703125, 0.1279296875], "r": 0.06, "tone": "fire"}, {"at": [0.9290364583333334, 0.1201171875], "r": 0.06, "tone": "fire"}, {"at": [0.3658854166666667, 0.5078125], "r": 0.028, "tone": "fire"}]},
  manage: {"src": "./art/town/manage.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.3072916666666667, 0.6123046875], "r": 0.035, "tone": "candle"}, {"at": [0.490234375, 0.6953125], "r": 0.028, "tone": "candle"}, {"at": [0.521484375, 0.689453125], "r": 0.028, "tone": "candle"}]},
  codexMon: {"src": "./art/town/codexMon.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.15559895833333334, 0.3505859375], "r": 0.035, "tone": "candle"}, {"at": [0.787109375, 0.3349609375], "r": 0.029, "tone": "candle"}]},
  codexItem: {"src": "./art/town/codexItem.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.5013020833333334, 0.263671875], "r": 0.032, "tone": "candle"}, {"at": [0.5494791666666666, 0.3974609375], "r": 0.025, "tone": "candle"}]},
  codexJob: {"src": "./art/town/codexJob.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.4016927083333333, 0.46484375], "r": 0.033, "tone": "crystal"}, {"at": [0.4895833333333333, 0.45703125], "r": 0.037, "tone": "soul"}, {"at": [0.5865885416666666, 0.4658203125], "r": 0.033, "tone": "lamp"}, {"at": [0.4934895833333333, 0.2021484375], "r": 0.029, "tone": "soul"}, {"at": [0.0625, 0.36328125], "r": 0.027, "tone": "candle"}]},
  codexAch: {"src": "./art/town/codexAch.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.919921875, 0.4609375], "r": 0.037, "tone": "candle"}]},
  treasury: {"src": "./art/town/treasury.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.06770833333333333, 0.1171875], "r": 0.06, "tone": "fire"}, {"at": [0.9322916666666666, 0.119140625], "r": 0.06, "tone": "fire"}, {"at": [0.201171875, 0.2734375], "r": 0.035, "tone": "fire"}, {"at": [0.796875, 0.2734375], "r": 0.035, "tone": "fire"}]},
  abyss: {"src": "./art/town/abyss.webp", "focus": [0.5, 0.48], "lights": [{"at": [0.5143229166666666, 0.6875], "r": 0.066, "tone": "soul"}, {"at": [0.0859375, 0.177734375], "r": 0.034, "tone": "lamp"}, {"at": [0.9498697916666666, 0.177734375], "r": 0.034, "tone": "lamp"}, {"at": [0.24739583333333334, 0.056640625], "r": 0.03, "tone": "fire"}]},
  panorama: {"src": "./art/town/panorama.webp", "lights": [{"at": [0.514, 0.726], "r": 0.015, "tone": "lamp"}, {"at": [0.432, 0.778], "r": 0.009, "tone": "lamp"}, {"at": [0.344, 0.63], "r": 0.016, "tone": "candle"}, {"at": [0.383, 0.633], "r": 0.017, "tone": "candle"}, {"at": [0.419, 0.645], "r": 0.014, "tone": "candle"}, {"at": [0.302, 0.63], "r": 0.012, "tone": "candle"}, {"at": [0.633, 0.694], "r": 0.014, "tone": "candle"}, {"at": [0.654, 0.694], "r": 0.014, "tone": "candle"}, {"at": [0.677, 0.701], "r": 0.012, "tone": "candle"}, {"at": [0.317, 0.868], "r": 0.028, "tone": "crystal"}, {"at": [0.154, 0.809], "r": 0.025, "tone": "soulgreen"}, {"at": [0.163, 0.276], "r": 0.057, "tone": "soulgreen"}, {"at": [0.871, 0.382], "r": 0.01, "tone": "candle"}], "w": 2400, "h": 1700, "spots": {"palace": [0.871, 0.335], "mansion": [0.394, 0.55], "tavern": [0.525, 0.645], "inn": [0.65, 0.595], "shop": [0.406, 0.707], "crypt": [0.158, 0.69], "shrine": [0.315, 0.808]}, "soul": {"gate": [0.154, 0.809], "vortex": [0.163, 0.276], "columnR": 0.012, "vortexR": 0.06}, "bands": [{"kind": "cloud", "y": 0.28, "h": 0.18, "alpha": 0.48, "speed": 0.032}, {"kind": "cloud", "y": 0.42, "h": 0.13, "alpha": 0.35, "speed": 0.022}, {"kind": "fog", "y": 0.76, "h": 0.065, "alpha": 0.25, "speed": 0.018}, {"kind": "fog", "y": 0.89, "h": 0.065, "alpha": 0.22, "speed": 0.012}]},
};
export const TOWN_KEEPERART = {
  barkeep: "./art/town/keepers/barkeep.webp",
  innkeeper: "./art/town/keepers/innkeeper.webp",
  maiden: "./art/town/keepers/maiden.webp",
  king: "./art/town/keepers/king.webp",
  minister: "./art/town/keepers/minister.webp",
  binder: "./art/town/keepers/binder.webp",
  merchant: "./art/town/keepers/merchant.webp",
};
export const TOWN_ICONART = {
  gate: "./art/town/icons/gate.webp",
  gateOpen: "./art/town/icons/gateOpen.webp",
  gateDone: "./art/town/icons/gateDone.webp",
  gateSealed: "./art/town/icons/gateSealed.webp",
  dive: "./art/town/icons/dive.webp",
  lock: "./art/town/icons/lock.webp",
  abyss: "./art/town/icons/abyss.webp",
};
// <</TOWN_KEYART>>
