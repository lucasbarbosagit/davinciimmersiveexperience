import glob
import os
import imageio.v2 as imageio

ROOT = r"C:\Users\lucas\Desktop\Nova pasta"
SEQ_DIR = os.path.join(ROOT, "blender", "renders", "sequence")
OUT = os.path.join(ROOT, "public", "assets", "gallery-flythrough.mp4")
FPS = 24

frames = sorted(glob.glob(os.path.join(SEQ_DIR, "frame_*.png")))
print("TOTAL_FRAMES:", len(frames))

writer = imageio.get_writer(
    OUT, fps=FPS, codec="libx264", quality=None,
    # -g 1: keyframe em TODO frame (intra-only). Sem isso o encoder usa
    # um GOP grande (~250 frames por default) e cada seek do scroll-scrub
    # precisa decodificar de tras pra frente ate o keyframe mais proximo
    # -- e o que travava no navegador. Arquivo fica maior, mas o scrub
    # vira O(1) por frame, que e o que importa aqui.
    ffmpeg_params=[
        "-crf", "18", "-preset", "slow", "-pix_fmt", "yuv420p",
        "-g", "1", "-keyint_min", "1", "-sc_threshold", "0",
    ],
)
for i, f in enumerate(frames):
    writer.append_data(imageio.imread(f))
    if i % 50 == 0:
        print("encoded", i, "/", len(frames))
writer.close()
print("DONE:", OUT)
