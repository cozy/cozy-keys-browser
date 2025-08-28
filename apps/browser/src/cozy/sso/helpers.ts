export const getLoginSuccessPageUri = (extensionUri: string) => {
  return `${extensionUri}/content/oidcSuccess.html`;
};

export const extractDomain = (companyEmail: string): string | null => {
  if (!companyEmail) {
    return null;
  }

  const email = companyEmail.trim();

  const atIndex = email.lastIndexOf("@");

  if (atIndex === -1) {
    return null;
  }

  return email.substring(atIndex + 1);
};
