"""Generate pixel art Claude Crab spritesheets — 8 animation states."""
from PIL import Image, ImageDraw
import os

OUT = "code/desktop-pet/public/assets"
FRAME = 64
SCALE = 1  # set to 2+ for easier editing, then downsample

# ---- Palette ----
BODY = (232, 93, 58, 255)       # #E85D3A 蟹壳
BODY_DARK = (201, 74, 42, 255)  # #C94A2A
CLAW = (244, 164, 96, 255)      # #F4A460
EYE_W = (255, 255, 255, 255)
EYE_P = (0, 0, 0, 255)
BELLY = (255, 200, 160, 255)
SWEAT = (130, 200, 255, 255)
LAPTOP = (80, 80, 80, 255)
SCREEN = (136, 204, 255, 255)
Z_COLOR = (200, 200, 255, 255)


def new_frame():
    """Create a 64x64 transparent RGBA image."""
    return Image.new("RGBA", (FRAME, FRAME), (0, 0, 0, 0))


def draw_crab_base(draw, ox=0, oy=0):
    """Core crab silhouette at origin (ox, oy). Body center at (32, 36)."""
    # Shell — main oval
    draw.ellipse([ox + 14, oy + 18, ox + 50, oy + 52], fill=BODY, outline=BODY_DARK)

    # Belly highlight
    draw.ellipse([ox + 22, oy + 26, ox + 42, oy + 44], fill=BELLY)

    # Eyes — white circles
    draw.ellipse([ox + 22, oy + 22, ox + 30, oy + 30], fill=EYE_W)
    draw.ellipse([ox + 34, oy + 22, ox + 42, oy + 30], fill=EYE_W)

    # Pupils — centered in eyes
    draw.ellipse([ox + 25, oy + 25, ox + 28, oy + 28], fill=EYE_P)
    draw.ellipse([ox + 38, oy + 25, ox + 41, oy + 28], fill=EYE_P)

    # Mouth — small arc / smile
    draw.arc([ox + 26, oy + 28, ox + 38, oy + 38], 0, 180, fill=EYE_P, width=1)

    # Legs — 4 small lines at bottom
    for lx in [ox + 18, ox + 24, ox + 36, ox + 42]:
        draw.line([lx, oy + 50, lx - 3, oy + 58], fill=BODY_DARK, width=2)
        draw.line([lx + 2, oy + 50, lx + 5, oy + 58], fill=BODY_DARK, width=2)

    # Claws — two ellipses on top sides
    draw.ellipse([ox + 6, oy + 8, ox + 22, oy + 26], fill=CLAW, outline=BODY_DARK)
    draw.ellipse([ox + 42, oy + 8, ox + 58, oy + 26], fill=CLAW, outline=BODY_DARK)

    # Claw pincers
    draw.polygon([ox + 6, oy + 16, ox + 2, oy + 10, ox + 10, oy + 14], fill=CLAW)
    draw.polygon([ox + 58, oy + 16, ox + 62, oy + 10, ox + 54, oy + 14], fill=CLAW)


def draw_closed_eyes(draw, ox=0, oy=0):
    """Closed-eye lines for blink/sleep."""
    draw.line([ox + 22, oy + 26, ox + 30, oy + 26], fill=EYE_P, width=2)
    draw.line([ox + 34, oy + 26, ox + 42, oy + 26], fill=EYE_P, width=2)


def draw_wide_eyes(draw, ox=0, oy=0):
    """Startled wide eyes."""
    draw.ellipse([ox + 21, oy + 20, ox + 31, oy + 32], fill=EYE_W)
    draw.ellipse([ox + 33, oy + 20, ox + 43, oy + 32], fill=EYE_W)
    draw.ellipse([ox + 24, oy + 23, ox + 29, oy + 29], fill=EYE_P)
    draw.ellipse([ox + 37, oy + 23, ox + 42, oy + 29], fill=EYE_P)
    # open mouth
    draw.ellipse([ox + 28, oy + 32, ox + 36, oy + 40], fill=EYE_P)


def save_spritesheet(frames, path):
    """Save list of 64x64 frames as horizontal spritesheet."""
    n = len(frames)
    sheet = Image.new("RGBA", (FRAME * n, FRAME), (0, 0, 0, 0))
    for i, f in enumerate(frames):
        sheet.paste(f, (i * FRAME, 0))
    os.makedirs(os.path.dirname(path), exist_ok=True)
    sheet.save(path)
    print(f"  {path} ({n} frames)")


# ============================================================
# IDLE WALK (8 frames) — body bobs up/down, legs shift
# ============================================================
def gen_walk():
    frames = []
    for i in range(8):
        f = new_frame()
        d = ImageDraw.Draw(f)
        # vertical bob
        bob = [0, -1, -2, -1, 0, 1, 2, 1][i]
        # horizontal lean
        lean = [0, 1, 2, 1, 0, -1, -2, -1][i]
        draw_crab_base(d, lean, bob)
        # alternate claw wave
        if i % 4 < 2:
            d.line([62, 16, 66, 12], fill=CLAW, width=2)  # right claw wave
        else:
            d.line([2, 16, -2, 12], fill=CLAW, width=2)  # left claw wave
        frames.append(f)
    return frames


# ============================================================
# IDLE BLINK (2 frames)
# ============================================================
def gen_idle():
    frames = []
    # Frame 1: open eyes
    f = new_frame()
    draw_crab_base(ImageDraw.Draw(f))
    frames.append(f)
    # Frame 2: closed eyes
    f = new_frame()
    d = ImageDraw.Draw(f)
    draw_crab_base(d)
    # overlay closed eyes
    draw_closed_eyes(d)
    frames.append(f)
    return frames


# ============================================================
# IDLE POKE (2 frames)
# ============================================================
def gen_poke():
    frames = []
    # Frame 1: squish down
    f = new_frame()
    d = ImageDraw.Draw(f)
    draw_crab_base(d, 0, 4)  # lowered
    draw_wide_eyes(d, 0, 4)
    frames.append(f)
    # Frame 2: bounce up
    f = new_frame()
    d = ImageDraw.Draw(f)
    draw_crab_base(d, 0, -4)  # raised
    draw_wide_eyes(d, 0, -4)
    frames.append(f)
    return frames


# ============================================================
# WORKING CODING (6 frames) — laptop in front, claws typing
# ============================================================
def draw_laptop(draw, ox=0, oy=0):
    """Small pixel laptop at bottom center."""
    # base
    draw.rectangle([ox + 20, oy + 48, ox + 44, oy + 50], fill=LAPTOP)
    # screen
    draw.rectangle([ox + 22, oy + 38, ox + 42, oy + 48], fill=SCREEN, outline=LAPTOP)
    # code lines on screen
    for ly in [oy + 40, oy + 43, oy + 46]:
        draw.line([ox + 25, ly, ox + 39, ly], fill=(255, 255, 255, 180), width=1)


def gen_coding():
    frames = []
    claw_positions = [(6, 40), (6, 42), (54, 40), (54, 42), (6, 40), (6, 42)]
    for i in range(6):
        f = new_frame()
        d = ImageDraw.Draw(f)
        # Body slightly higher to fit laptop
        draw_crab_base(d, 0, -4)
        draw_laptop(d)
        # Claw typing — alternate left/right
        cx, cy = claw_positions[i]
        d.ellipse([cx - 4, cy - 4, cx + 6, cy + 6], fill=CLAW)
        # Focus expression — slightly narrowed eyes
        d.line([24, 26, 28, 26], fill=EYE_P, width=1)
        d.line([36, 26, 40, 26], fill=EYE_P, width=1)
        frames.append(f)
    return frames


# ============================================================
# WORKING SWEAT (3 frames)
# ============================================================
def gen_sweat():
    frames = []
    for i in range(3):
        f = new_frame()
        d = ImageDraw.Draw(f)
        draw_crab_base(d)
        # Sweat drop if i < 2
        if i < 2:
            d.ellipse([44, 14, 48, 20], fill=SWEAT)
        # Claw wiping if i == 1
        if i == 1:
            d.ellipse([38, 16, 50, 24], fill=CLAW, outline=BODY_DARK)
        # Relieved expression on last frame
        if i == 2:
            d.arc([26, 32, 38, 40], 0, 180, fill=EYE_P, width=1)
        frames.append(f)
    return frames


# ============================================================
# COMPLETE PHONE (4 frames)
# ============================================================
def gen_phone():
    frames = []
    for i in range(4):
        f = new_frame()
        d = ImageDraw.Draw(f)
        draw_crab_base(d, 0, 0)
        # Phone in right claw area
        px, py = 48, 28
        d.rounded_rectangle([px, py, px + 12, py + 18], radius=2, fill=(40, 40, 40, 255))
        d.rectangle([px + 2, py + 3, px + 10, py + 15], fill=SCREEN)
        # Content on phone varies
        phone_content = [1, 1, 0, 1]
        if phone_content[i]:
            d.line([px + 4, py + 6, px + 8, py + 6], fill=(255, 255, 255, 200), width=1)
            d.line([px + 4, py + 9, px + 7, py + 9], fill=(255, 255, 255, 150), width=1)
        # Bite lip / focused expression
        d.arc([26, 30, 38, 36], 0, 180, fill=EYE_P, width=1)
        frames.append(f)
    return frames


# ============================================================
# ERROR PANIC (2 frames)
# ============================================================
def gen_panic():
    frames = []
    for i in range(2):
        f = new_frame()
        d = ImageDraw.Draw(f)
        draw_crab_base(d)
        draw_wide_eyes(d)
        # Sweat drops increase
        for sx in [44, 48, 52] if i == 1 else [44, 48]:
            d.ellipse([sx, 12, sx + 4, 18], fill=SWEAT)
        # Wavy mouth
        d.arc([28, 34, 36, 42], 0, 180, fill=EYE_P, width=1)
        # Raised claws
        dy = -2 if i == 1 else 0
        d.ellipse([6, 8 + dy, 18, 22 + dy], fill=CLAW, outline=BODY_DARK)
        d.ellipse([46, 8 + dy, 58, 22 + dy], fill=CLAW, outline=BODY_DARK)
        frames.append(f)
    return frames


# ============================================================
# SLEEP (4 frames) — breathing cycle
# ============================================================
def gen_sleep():
    frames = []
    for i in range(4):
        f = new_frame()
        d = ImageDraw.Draw(f)
        # Body compresses/expands
        scale_y = [0, 1, 2, 1][i]  # compress during exhale
        draw_crab_base(d, 0, scale_y)
        draw_closed_eyes(d, 0, scale_y)
        # Z's floating on frames 2-3
        if i in [2, 3]:
            zx, zy = 44, 10 - i * 2
            d.text((zx, zy), "Z", fill=Z_COLOR)
        frames.append(f)
    return frames


# ============================================================
# Main
# ============================================================
if __name__ == "__main__":
    base = os.path.join(OUT)

    save_spritesheet(gen_walk(),   os.path.join(base, "idle/walk.png"))
    save_spritesheet(gen_idle(),   os.path.join(base, "idle/idle.png"))
    save_spritesheet(gen_poke(),   os.path.join(base, "idle/poke.png"))
    save_spritesheet(gen_coding(), os.path.join(base, "working/coding.png"))
    save_spritesheet(gen_sweat(),  os.path.join(base, "working/sweat.png"))
    save_spritesheet(gen_phone(),  os.path.join(base, "complete/phone.png"))
    save_spritesheet(gen_panic(),  os.path.join(base, "error/panic.png"))
    save_spritesheet(gen_sleep(),  os.path.join(base, "sleep/sleep.png"))

    print("Done — 8 spritesheets generated.")
