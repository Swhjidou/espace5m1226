import os

import qrcode
from PIL import Image, ImageDraw, ImageFont

URL = "https://espace5t1226.netlify.app/"
TEXTE = "Prof: Elbou Sidi Ahmed\nClasse: 5C/D"  # texte écrit AU CENTRE du QR code
DOSSIER = "static/images"
FICHIER = os.path.join(DOSSIER, "qr_code.png")

# Couleur du rectangle central (cadre + texte) : modifiable
BLEU = (0, 70, 200)
ORANGE = (237, 125, 49)

# Part maximale du QR couverte par le texte (largeur, hauteur).
# Gardez des valeurs raisonnables : le centre masqué ne doit pas empêcher la lecture.
LARGEUR_MAX = 0.42
HAUTEUR_MAX = 0.09


def creer_qr_code(url: str, chemin: str) -> None:
    """Génère un QR code (haute correction d'erreur) pour l'URL donnée."""
    os.makedirs(os.path.dirname(chemin), exist_ok=True)

    qr = qrcode.QRCode(
        version=None,  # taille automatique selon la longueur de l'URL
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=20,  # image plus grande = texte plus net
        border=4,
    )
    qr.add_data(url)
    qr.make(fit=True)

    img = qr.make_image(fill_color="black", back_color="white")
    img.save(chemin)


def charger_police(taille: int) -> ImageFont.ImageFont:
    """Cherche une police grasse (Windows, Linux, Mac), sinon police par défaut."""
    candidats = [
        "arialbd.ttf",
        "arial.ttf",
        "DejaVuSans-Bold.ttf",
        "Arial Bold.ttf",
    ]
    for nom in candidats:
        try:
            return ImageFont.truetype(nom, taille)
        except OSError:
            continue
    return ImageFont.load_default()


def ajouter_texte_centre(chemin: str, texte: str) -> None:
    """Écrit le texte au centre du QR, dans un rectangle arrondi bleu."""
    img = Image.open(chemin).convert("RGB")
    largeur, hauteur = img.size
    draw = ImageDraw.Draw(img)

    marge = max(8, int(largeur * 0.015))

    # On réduit la police jusqu'à ce que le bloc soit assez petit
    taille = 200
    while taille > 10:
        police = charger_police(taille)
        b = draw.multiline_textbbox((0, 0), texte, font=police, align="center")
        larg_txt = b[2] - b[0]
        haut_txt = b[3] - b[1]
        if (larg_txt + 2 * marge <= largeur * LARGEUR_MAX
                and haut_txt + 2 * marge <= hauteur * HAUTEUR_MAX):
            break
        taille -= 2

    bloc_l = larg_txt + 2 * marge
    bloc_h = haut_txt + 2 * marge
    x0 = (largeur - bloc_l) / 2
    y0 = (hauteur - bloc_h) / 2

    # Fond blanc arrondi derrière le texte, cadre bleu
    draw.rounded_rectangle(
        [x0, y0, x0 + bloc_l, y0 + bloc_h],
        radius=marge,
        fill="white",
        outline=ORANGE,
        width=max(2, marge // 3),
    )

    # Texte centré en bleu
    x = x0 + marge - b[0]
    y = y0 + marge - b[1]
    draw.multiline_text((x, y), texte, fill=ORANGE, font=police, align="center")

    img.save(chemin)


if __name__ == "__main__":
    creer_qr_code(URL, FICHIER)
    ajouter_texte_centre(FICHIER, TEXTE)
    print(f"QR code créé pour : {URL}")
    print(f"Texte au centre : {TEXTE}")
    print(f"Fichier sauvegardé : {FICHIER}")