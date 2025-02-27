const fetchPublicKey = async (selectedRepo, githubToken) => {
  if (!selectedRepo) return null;
  try {
    const [owner, repo] = selectedRepo.split('/');
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/secrets/public-key`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      const message = await response.json().then(data => data.message || 'HTTP error!');
      throw new Error(`Failed to fetch public key: ${response.status} - ${message}`);
    }
    return response.json();
  } catch (error) {
    console.error("Error fetching public key:", error);
    throw new Error('Failed to fetch public key.');
  }
};

const encryptSecretValue = async (secretValue, publicKeyBase64) => {
  if (!publicKeyBase64) {
    throw new Error("Public key is not available for encryption.");
  }
  try {
    console.log("Public Key (Base64) before processing:", publicKeyBase64);

    const publicKeyDer = base64ToArrayBuffer(publicKeyBase64);
    console.log("publicKeyDer (ArrayBuffer) after base64 decode:", publicKeyDer);
    console.log("publicKeyDer.byteLength:", publicKeyDer.byteLength); // Log key length


    const rsaOaepParams = { name: 'RSA-OAEP', hash: { name: 'SHA-256' } }; // Explicit algorithm params


    try {
      await window.crypto.subtle.importKey(
        'spki',
        publicKeyDer,
        rsaOaepParams,
        true,
        ['encrypt']
      );
      console.log("Public key imported SUCCESSFULLY (but encryption step is still skipped in this debug version).");
      return 'encryption-step-skipped-due-to-debug'; // Indicate import success

    } catch (importKeyError) {
      console.error("Detailed Error during importKey:", importKeyError);
      console.error("Error Name:", importKeyError.name);
      console.error("Error Message:", importKeyError.message);
      throw new Error(`Failed to import public key: ${importKeyError.message}`);
    }

  } catch (error) {
    console.error("Error encrypting secret value:", error);
    throw error;
  }
};


const base64ToArrayBuffer = (base64) => {
  try {
    const binaryString = window.atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    console.error("Error in base64ToArrayBuffer:", e);
    throw e; // Re-throw to indicate base64 decoding failure
  }
}

const arrayBufferToBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};


const updateRepositorySecret = async (selectedRepo, githubToken, secretName, secretValue) => {
  if (!selectedRepo) return;
  try {
    const publicKeyData = await fetchPublicKey(selectedRepo, githubToken);
    if (!publicKeyData) {
      return; // Exit if public key fetch fails
    }

    // TEMPORARY BYPASS ENCRYPTION FOR DEBUGGING - INSECURE FOR PRODUCTION
    // const encryptedValue = await encryptSecretValue(secretValue, publicKeyData.key);
    const encryptedValue = window.btoa(secretValue); // BASE64 PLAINTEXT - INSECURE!
    console.warn("WARNING: Encryption BYPASSED - Sending PLAINTEXT secret value as Base64! INSECURE!");


    // if (encryptedValue === 'encryption-step-skipped-due-to-debug') { // Skip API call if importKey is the focus
    //   return;
    // }


    const keyId = publicKeyData.key_id;
    const [owner, repo] = selectedRepo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
        body: JSON.stringify({
          encrypted_value: encryptedValue,
          key_id: keyId,
        }),
      }
    );
    if (!response.ok) {
      const message = await response.json().then(data => data.message || 'HTTP error!');
      throw new Error(`Failed to update secret: ${response.status} - ${message}`);
    }
    return response;
  } catch (error) {
    console.error("Error updating repository secret:", error);
    throw error;
  }
};


const deleteSecret = async (selectedRepo, githubToken, secretName) => {
  if (!selectedRepo || !secretName) return;
  try {
    const [owner, repo] = selectedRepo.split('/');
    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/secrets/${secretName}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${githubToken}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      }
    );
    if (!response.ok) {
      const message = await response.json().then(data => data.message || 'HTTP error!');
      throw new Error(`Failed to delete secret: ${response.status} - ${message}`);
    }
    return response;
  } catch (error) {
    console.error("Error deleting secret:", error);
    throw error;
  }
};

const fetchSecrets = async (selectedRepo, githubToken) => {
  if (!selectedRepo) return;
  try {
    const [owner, repo] = selectedRepo.split('/');
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/actions/secrets`, {
      headers: {
        Authorization: `Bearer ${githubToken}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    return data.secrets;
  } catch (err) {
    console.error('Failed to fetch secrets:', err);
    throw new Error('Failed to fetch secrets.');
  }
};


export { fetchSecrets, updateRepositorySecret, deleteSecret, fetchPublicKey };
