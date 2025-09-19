const translations = {
  en: {
    title: "Twake Pass Extension",
    successMessage: "You have been logged in to your Twake Workplace successfully.",
    instructionText: "Open the extension and enter your password for Twake Pass to complete login.",
    helpLink: "I need help?",
    logoAlt: "ID Logo",
    twakePassAlt: "Twake Pass",
    extensionAlt: "Twake Pass Extension"
  },
  fr: {
    title: "Extension Twake Pass",
    successMessage: "Vous avez été connecté à votre espace de travail Twake avec succès.",
    instructionText: "Ouvrez l'extension et saisissez votre mot de passe pour Twake Pass afin de terminer la connexion.",
    helpLink: "J'ai besoin d'aide ?",
    logoAlt: "Logo ID",
    twakePassAlt: "Twake Pass",
    extensionAlt: "Extension Twake Pass"
  }
};

function detectLanguage() {
  const browserLang = navigator.language || navigator.userLanguage;
  const langCode = browserLang.split('-')[0].toLowerCase();

  return translations[langCode] ? langCode : 'en';
}

function applyTranslations(lang) {
  const t = translations[lang];

  document.title = t.title;

  document.querySelectorAll('[data-i18n]').forEach(element => {
    const key = element.getAttribute('data-i18n');
    if (t[key]) {
      element.textContent = t[key];
    }
  });

  document.querySelectorAll('img[alt]').forEach(img => {
    const src = img.src;
    if (src.includes('logo-id.png') && t.logoAlt) {
      img.alt = t.logoAlt;
    } else if (src.includes('logo-text.png') && t.twakePassAlt) {
      img.alt = t.twakePassAlt;
    } else if (src.includes('mockup.png') && t.extensionAlt) {
      img.alt = t.extensionAlt;
    }
  });
}

document.addEventListener('DOMContentLoaded', function() {
  const language = detectLanguage();
  applyTranslations(language);
});
