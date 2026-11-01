// ========== CONFIGURATION ==========
// Les mots de passe ne sont plus écrits en clair : on stocke uniquement
// leur empreinte SHA-256 (sel + NOM + mot de passe).
// ⚠️ Sur un site statique (GitHub Pages) cela reste un simple verrou :
// il décourage les curieux mais ne remplace pas une vraie authentification serveur.
const SEL = "espace-eleve-2027";
const IDENTIFIANTS = {
    "5CG4": "b850c25467e8c318b8e087720815db5602cb09566881b5037a36edd0f4419af4",
    "SWH": "8eff4fa48e86b3e0c71aaed8360e26d49b1d675b518dcb04e76ff635ccbee452",
};
const COMPTE_ADMIN = "5CG4";
const INACTIVITY_DELAY = 2 * 60 * 1000; // 2 minutes

// ========== OUTILS ==========
async function sha256(texte) {
    const octets = new TextEncoder().encode(texte);
    const hash = await crypto.subtle.digest('SHA-256', octets);
    return Array.from(new Uint8Array(hash))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
}

function lireStockage(cle, defaut) {
    try {
        const v = localStorage.getItem(cle);
        return v === null ? defaut : JSON.parse(v);
    } catch (e) {
        return defaut;
    }
}

function ecrireStockage(cle, valeur) {
    try {
        localStorage.setItem(cle, JSON.stringify(valeur));
    } catch (e) { /* stockage indisponible : on ignore */ }
}

// ========== PROTECTIONS LÉGÈRES ==========
// Rappel : un navigateur ne peut pas détecter ni empêcher une vraie capture d'écran.
// Ces protections ne servent qu'à décourager les actions les plus simples.
function showScreenshotWarning() {
    const warning = document.getElementById('screenshotWarning');
    if (!warning) return;
    warning.style.display = 'block';
    setTimeout(() => { warning.style.display = 'none'; }, 2000);
}

document.addEventListener('keydown', function (e) {
    const k = (e.key || '').toLowerCase();
    const bloque =
        e.key === 'PrintScreen' ||
        (e.ctrlKey && k === 's') ||
        (e.ctrlKey && k === 'p') ||
        (e.ctrlKey && k === 'u') ||
        (e.ctrlKey && e.shiftKey && (k === 'i' || k === 's')) ||
        (e.metaKey && e.shiftKey && ['3', '4', '5'].includes(e.key)) ||
        e.key === 'F12';

    if (bloque) {
        e.preventDefault();
        showScreenshotWarning();
    }
});

document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => { if (e.target.tagName === 'IMG') e.preventDefault(); });
document.addEventListener('copy', e => { e.preventDefault(); showScreenshotWarning(); });

// Filigrane (ajouté une seule fois)
function ajouterFiligrane(nom) {
    let filigrane = document.getElementById('filigrane');
    if (!filigrane) {
        filigrane = document.createElement('div');
        filigrane.id = 'filigrane';
        document.body.appendChild(filigrane);
    }
    filigrane.textContent = '© Espace Élève – ' + nom + ' – ' + new Date().toLocaleDateString('fr-FR');
}

// ========== COMPTEUR DE CONNEXIONS (par appareil) ==========
// ⚠️ Stocké dans localStorage : ne compte que les connexions faites depuis ce navigateur.
// Pour un vrai compteur global, il faut une base de données (Firebase, Supabase…).
function afficherStatsVisiteurs() {
    const total = lireStockage('totalVisitors', 0);
    const dernier = lireStockage('lastVisitor', null);

    document.getElementById('visitorCounter').textContent = total;
    document.getElementById('lastVisitorInfo').textContent = dernier
        ? 'Dernière connexion : ' + dernier.name + ' le ' + dernier.date
        : 'Aucune connexion pour le moment';
}

function enregistrerVisiteur(nom) {
    const total = lireStockage('totalVisitors', 0) + 1;
    const maintenant = new Date();
    const date = maintenant.toLocaleDateString('fr-FR') + ' à ' + maintenant.toLocaleTimeString('fr-FR');

    ecrireStockage('totalVisitors', total);
    ecrireStockage('lastVisitor', { name: nom, date: date });
}

// ========== INACTIVITÉ ==========
let inactivityTimer = null;

function estConnecte() {
    return sessionStorage.getItem('is-connected') === 'true';
}

function demarrerMinuteur() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(bloquerPageParInactivite, INACTIVITY_DELAY);
}

function reinitialiserMinuteur() {
    if (estConnecte()) demarrerMinuteur();
}

function bloquerPageParInactivite() {
    deconnecter();

    const errorDiv = document.getElementById('errorMessage');
    errorDiv.textContent = "Session expirée : 2 minutes d'inactivité. Veuillez vous reconnecter.";
    errorDiv.style.display = 'block';
    setTimeout(() => { errorDiv.style.display = 'none'; }, 4000);
}

function deconnecter() {
    sessionStorage.removeItem('is-connected');
    sessionStorage.removeItem('user-name');
    clearTimeout(inactivityTimer);
    inactivityTimer = null;

    document.getElementById('contenu-page').style.display = 'none';
    document.getElementById('verrouillage').style.display = 'flex';
    document.getElementById('fullName').value = '';
    document.getElementById('password').value = '';
    document.getElementById('erreur-code').style.display = 'none';

    const filigrane = document.getElementById('filigrane');
    if (filigrane) filigrane.remove();

    fermerPleinEcran();
}

// Écouteurs d'activité enregistrés UNE seule fois
['mousedown', 'mousemove', 'keydown', 'scroll', 'click', 'touchstart']
    .forEach(evt => document.addEventListener(evt, reinitialiserMinuteur, { passive: true }));

// ========== CONNEXION ==========
function afficherEspace(nom) {
    document.getElementById('contenu-page').style.display = 'block';
    document.getElementById('verrouillage').style.display = 'none';
    document.getElementById('messageBienvenue').textContent = 'Bonjour dans la classe de ' + nom + ' ! 👋';

    const statsContainer = document.getElementById('visitorStatsContainer');
    if (nom === COMPTE_ADMIN) {
        afficherStatsVisiteurs();
        statsContainer.style.display = 'block';
    } else {
        statsContainer.style.display = 'none';
    }

    restaurerCompteursVues();
    ajouterFiligrane(nom);
    demarrerMinuteur();
}

async function seConnecter() {
    const nom = document.getElementById('fullName').value.trim().toUpperCase();
    const motDePasse = document.getElementById('password').value;
    const erreurCode = document.getElementById('erreur-code');

    const empreinteSaisie = await sha256(SEL + ':' + nom + ':' + motDePasse);
    const empreinteAttendue = IDENTIFIANTS[nom];

    if (empreinteAttendue && empreinteSaisie === empreinteAttendue) {
        erreurCode.style.display = 'none';

        if (nom === COMPTE_ADMIN) enregistrerVisiteur(nom);

        sessionStorage.setItem('user-name', nom);
        sessionStorage.setItem('is-connected', 'true');

        afficherEspace(nom);
    } else {
        erreurCode.style.display = 'block';
        document.getElementById('password').value = '';
    }
}

document.getElementById('btnConnexion').addEventListener('click', seConnecter);
document.getElementById('password').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') seConnecter();
});

function verifierConnexionExistante() {
    if (estConnecte()) {
        afficherEspace(sessionStorage.getItem('user-name') || '');
    }
}

// La session vit dans sessionStorage : elle disparaît toute seule à la fermeture
// de l'onglet, et survit à un simple rechargement de la page.
window.addEventListener('load', verifierConnexionExistante);

// ========== GALERIE PHOTO ==========
let indexActuel = 0;
let photosActuelles = [];
const modele = document.getElementById('modele');
const imageModele = document.getElementById('imageModele');

// Compteurs de vues : mémorisés par appareil
function restaurerCompteursVues() {
    const vues = lireStockage('imageViews', {});
    Object.keys(vues).forEach(id => {
        const el = document.getElementById('counter_' + id);
        if (el) el.textContent = vues[id];
    });
}

function incrementerVues(imageId) {
    const vues = lireStockage('imageViews', {});
    vues[imageId] = (vues[imageId] || 0) + 1;
    ecrireStockage('imageViews', vues);

    const el = document.getElementById('counter_' + imageId);
    if (el) el.textContent = vues[imageId];
}

function ouvrirPleinEcran(index, idOnglet) {
    photosActuelles = document.querySelectorAll('#' + idOnglet + ' .gallery img');
    if (!photosActuelles.length) return;

    indexActuel = index;
    modele.style.display = 'flex';
    imageModele.src = photosActuelles[indexActuel].src;

    const imageId = photosActuelles[indexActuel].dataset.id;
    if (imageId) incrementerVues(imageId);
}

function fermerPleinEcran() {
    modele.style.display = 'none';
}

function photoSuivante() {
    if (!photosActuelles.length) return;
    indexActuel = (indexActuel + 1) % photosActuelles.length;
    imageModele.src = photosActuelles[indexActuel].src;
    incrementerVues(photosActuelles[indexActuel].dataset.id);
}

function photoPrecedente() {
    if (!photosActuelles.length) return;
    indexActuel = (indexActuel - 1 + photosActuelles.length) % photosActuelles.length;
    imageModele.src = photosActuelles[indexActuel].src;
    incrementerVues(photosActuelles[indexActuel].dataset.id);
}

document.addEventListener('keydown', function (e) {
    if (modele.style.display === 'flex') {
        if (e.key === 'ArrowRight') photoSuivante();
        if (e.key === 'ArrowLeft') photoPrecedente();
        if (e.key === 'Escape') fermerPleinEcran();
    }
});

// ========== CONTENEURS DE DOCUMENTS (.pdf / .docx) ==========
// Pour ajouter un fichier : copiez-le dans static/docs/ puis ajoutez une ligne ici.
const DOCUMENTS = [
    {
        titre: "Séries d'exercices",
        fichiers: [
            { nom: "Série 1 – FORCES & ETALONNAGE DU RESSORT", fichier: "static/docs/S1PFOETC.pdf" },
            // { nom: "Série 2 – Fonctions numériques", fichier: "static/docs/courts.docx" }
        ]
    },
    // {
    //     titre: "Devoirs",
    //     fichiers: [
    //         { nom: "Devoir surveillé n°1", fichier: "static/docs/devoir1.pdf" }
    //     ]
    // },
    {
        titre: "Cours",
        fichiers: []
    }
];

function creerElement(tag, classe, texte) {
    const el = document.createElement(tag);
    if (classe) el.className = classe;
    if (texte !== undefined) el.textContent = texte;
    return el;
}

function afficherDocuments() {
    const zone = document.getElementById('documents');
    zone.textContent = '';

    DOCUMENTS.forEach(function (conteneur) {
        const carte = creerElement('div', 'doc-container');

        // En-tête cliquable du conteneur
        const entete = creerElement('button', 'doc-header');
        entete.type = 'button';
        entete.setAttribute('aria-expanded', 'false');
        entete.appendChild(creerElement('span', 'doc-folder', '📁'));

        const titres = creerElement('span', 'doc-titles');
        titres.appendChild(creerElement('span', 'doc-name', conteneur.titre));
        const n = conteneur.fichiers.length;
        titres.appendChild(creerElement('span', 'doc-count',
            n === 0 ? 'Aucun fichier' : n + (n > 1 ? ' fichiers' : ' fichier')));
        entete.appendChild(titres);
        entete.appendChild(creerElement('span', 'doc-arrow', '▾'));

        // Pile de fichiers
        const pile = creerElement('div', 'doc-stack');
        if (n === 0) {
            pile.appendChild(creerElement('div', 'doc-empty', 'Ce conteneur est vide pour le moment.'));
        }

        conteneur.fichiers.forEach(function (f) {
            const ext = f.fichier.split('.').pop().toLowerCase();
            const estPdf = ext === 'pdf';

            const ligne = creerElement('div', 'doc-file');
            ligne.appendChild(creerElement('span', 'doc-icon ' + (estPdf ? 'pdf' : 'docx'),
                estPdf ? 'PDF' : 'DOCX'));
            ligne.appendChild(creerElement('span', 'doc-file-name', f.nom));

            const actions = creerElement('span', 'doc-actions');

            if (estPdf) {
                const ouvrir = creerElement('a', 'doc-btn', 'Ouvrir');
                ouvrir.href = f.fichier;
                ouvrir.target = '_blank';
                ouvrir.rel = 'noopener';
                actions.appendChild(ouvrir);
            }

            const telecharger = creerElement('a', 'doc-btn doc-btn-dl', 'Télécharger');
            telecharger.href = f.fichier;
            telecharger.setAttribute('download', '');
            actions.appendChild(telecharger);

            ligne.appendChild(actions);
            pile.appendChild(ligne);
        });

        entete.addEventListener('click', function () {
            const ouvert = carte.classList.toggle('open');
            entete.setAttribute('aria-expanded', ouvert ? 'true' : 'false');
        });

        carte.appendChild(entete);
        carte.appendChild(pile);
        zone.appendChild(carte);
    });
}

afficherDocuments();

// ========== DOSSIERS (docs / images) ==========
function ouvrirDossier(nom) {
    reinitialiserMinuteur();
    document.getElementById('vueDossiers').style.display = 'none';
    document.querySelectorAll('.dossier-vue').forEach(v => { v.style.display = 'none'; });
    document.getElementById('dossier-' + nom).style.display = 'block';
}

function retourDossiers() {
    reinitialiserMinuteur();
    document.querySelectorAll('.dossier-vue').forEach(v => { v.style.display = 'none'; });
    document.getElementById('vueDossiers').style.display = 'block';
}

// ========== ONGLETS ==========
function ouvrirOnglet(evt, nomOnglet) {
    reinitialiserMinuteur();

    document.querySelectorAll('.tab-content').forEach(t => { t.style.display = 'none'; });
    document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));

    document.getElementById(nomOnglet).style.display = 'block';
    if (evt && evt.currentTarget) evt.currentTarget.classList.add('active');

    // En revenant sur la classe, on repart toujours de la vue des dossiers
    if (nomOnglet === 'classe5') retourDossiers();
}