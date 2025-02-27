import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { fetchSecrets, updateRepositorySecret, deleteSecret, fetchPublicKey } from './githubApi';

function App() {
  const [githubToken, setGithubToken] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [repos, setRepos] = useState([]);
  const [selectedRepo, setSelectedRepo] = useState('');
  const [secrets, setSecrets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');
  const [isBulkDeleteConfirmationOpen, setIsBulkDeleteConfirmationOpen] = useState(false);
  const [isDeleteConfirmationOpen, setIsDeleteConfirmationOpen] = useState(false);
  const [secretToDelete, setSecretToDelete] = useState('');
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isExportOpen, setIsExportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [exportedSecrets, setExportedSecrets] = useState(null);
  const [isAddSecretOpen, setIsAddSecretOpen] = useState(false);
  const [isEditSecretOpen, setIsEditSecretOpen] = useState(false);
  const [secretToEdit, setSecretToEdit] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredSecrets, setFilteredSecrets] = useState([]);
  // New state variables for .env file upload
  const [isEnvUploadOpen, setIsEnvUploadOpen] = useState(false);
  const [envFile, setEnvFile] = useState(null);
  const [parsedEnvContent, setParsedEnvContent] = useState([]);
  const [isEnvUploading, setIsEnvUploading] = useState(false);

  const { register, handleSubmit, setValue, formState: { errors }, reset } = useForm();

  useEffect(() => {
    const token = sessionStorage.getItem('githubToken');
    if (token) {
      setGithubToken(token);
      validateToken(token);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated && selectedRepo) {
      loadSecrets();
    }
  }, [isAuthenticated, selectedRepo]);

  useEffect(() => {
    if (searchQuery && secrets.length > 0) {
      const filtered = secrets.filter(secret =>
        secret.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSecrets(filtered);
    } else {
      setFilteredSecrets(secrets);
    }
  }, [searchQuery, secrets]);


  const validateToken = async (token) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        headers: {
          Authorization: `token ${token}`,
        },
      });
      if (response.status === 200) {
        setIsAuthenticated(true);
        sessionStorage.setItem('githubToken', token);
        const data = await response.json();
        setRepos(data);
        setError('');
      }
    } catch (err) {
      setIsAuthenticated(false);
      sessionStorage.removeItem('githubToken');
      setError('Invalid GitHub token or insufficient permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (data) => {
    setGithubToken(data.token);
    validateToken(data.token);
  };

  const loadSecrets = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError('');
    try {
      const fetchedSecrets = await fetchSecrets(selectedRepo, githubToken);
      setSecrets(fetchedSecrets || []);
      setError('');
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const handleAddSecret = async (data) => {
    if (!selectedRepo) return;
    setLoading(true);
    setError('');
    setNotification('');
    try {
      const publicKeyData = await fetchPublicKey(selectedRepo, githubToken);
      if (!publicKeyData) {
        setError("Failed to fetch public key, cannot add secret.");
        setLoading(false);
        return;
      }
      console.log("Public Key Data:", publicKeyData); // Log public key data

      await updateRepositorySecret(selectedRepo, githubToken, data.secretName, data.secretValue);
      loadSecrets();
      setNotification('Secret added successfully!');
      setIsAddSecretOpen(false);
      reset();
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const handleModifySecret = async (data) => {
    if (!selectedRepo || !secretToEdit) return;
    setLoading(true);
    setError('');
    setNotification('');
    try {
      await updateRepositorySecret(selectedRepo, githubToken, secretToEdit.name, data.secretValue);
      loadSecrets();
      setNotification('Secret modified successfully!');
      setIsEditSecretOpen(false);
      setSecretToEdit(null);
      reset();
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const handleDeleteSecretConfirmation = (secretName) => {
    setSecretToDelete(secretName);
    setIsDeleteConfirmationOpen(true);
  };

  const handleDeleteSecret = async () => {
    if (!selectedRepo || !secretToDelete) return;
    setLoading(true);
    setError('');
    setNotification('');
    setIsDeleteConfirmationOpen(false);
    try {
      await deleteSecret(selectedRepo, githubToken, secretToDelete);
      loadSecrets();
      setNotification('Secret deleted successfully!');
      setSecretToDelete('');
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBulkDeleteConfirmation = () => {
    setIsBulkDeleteConfirmationOpen(true);
  };

  const handleBulkDeleteSecrets = async () => {
    if (!selectedRepo) return;
    setIsBulkDeleteConfirmationOpen(false);
    if (secrets.length === 0) {
      setNotification('No secrets to delete.');
      return;
    }

    setLoading(true);
    setError('');
    setNotification('');
    try {
      await Promise.all(secrets.map(secret => deleteSecret(selectedRepo, githubToken, secret.name)));
      loadSecrets();
      setNotification('All secrets deleted successfully!');
    } catch (err) {
      setError(err.message);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleImportSecrets = async () => {
    if (!importFile || !selectedRepo) return;
    setLoading(true);
    setError('');
    setNotification('');
    setIsImportOpen(false);
    try {
      const fileReader = new FileReader();
      fileReader.onload = async (event) => {
        try {
          const jsonData = JSON.parse(event.target.result);
          if (!Array.isArray(jsonData)) {
            setError('Invalid JSON format: Must be an array of secrets.');
            setLoading(false);
            return;
          }


          await Promise.all(jsonData.map(async (secret) => {
            if (!secret.name || !secret.value) {
              throw new Error('Invalid secret format in JSON: Must include "name" and "value".');
            }
            await updateRepositorySecret(selectedRepo, githubToken, secret.name, secret.value);
          }));
          loadSecrets();
          setNotification('Secrets imported successfully!');
        } catch (parseError) {
          setError('Failed to parse or import secrets from JSON. Invalid format or content.');
          console.error("JSON Parse Error:", parseError);
        } finally {
          setLoading(false);
          setImportFile(null);
        }
      };
      fileReader.readAsText(importFile);
    } catch (err) {
      setError('Failed to import secrets.');
      console.error(err);
      setLoading(false);
      setIsImportOpen(false);
      setImportFile(null);
    }
  };


  const handleExportSecrets = async () => {
    if (!selectedRepo) return;
    setLoading(true);
    setError('');
    setIsExportOpen(false);
    try {
      setExportedSecrets(secrets);
      setNotification('Secrets ready for export!');
    } catch (err) {
      setError('Failed to export secrets.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const downloadExportedSecrets = () => {
    if (!exportedSecrets) return;
    const jsonString = JSON.stringify(exportedSecrets.map(secret => ({ name: secret.name, updated_at: secret.updated_at })), null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `secrets-export-${selectedRepo.replace('/', '-')}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setExportedSecrets(null);
    setNotification('Secrets exported and downloaded!');
  };


  const handleRepoChange = (event) => {
    setSelectedRepo(event.target.value);
    setSecrets([]);
    setSearchQuery('');
  };

  const openAddSecretModal = () => {
    setIsAddSecretOpen(true);
  };

  const closeAddSecretModal = () => {
    setIsAddSecretOpen(false);
    reset();
  };

  const openEditSecretModal = (secret) => {
    setSecretToEdit(secret);
    setValue('secretName', secret.name); // Populate secret name for edit - consider if name should be editable
    setIsEditSecretOpen(true);
  };

  const closeEditSecretModal = () => {
    setIsEditSecretOpen(false);
    setSecretToEdit(null);
    reset();
  };

  const handleSearchChange = (event) => {
    setSearchQuery(event.target.value);
  };

  const handleEnvFileUpload = (e) => {
    if (e.target.files[0]) {
      setEnvFile(e.target.files[0]);
    }
  };

  const parseEnvFile = () => {
    if (!envFile) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      const lines = content.split('\n');
      const parsedSecrets = [];
      
      lines.forEach(line => {
        // Skip empty lines or comments
        if (!line.trim() || line.startsWith('#')) return;
        
        // Look for key=value pattern
        const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
        if (match) {
          let [, key, value = ''] = match;
          // Remove quotes if they exist
          value = value.trim();
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.slice(1, -1);
          } else if (value.startsWith("'") && value.endsWith("'")) {
            value = value.slice(1, -1);
          }
          
          parsedSecrets.push({ name: key, value });
        }
      });
      
      setParsedEnvContent(parsedSecrets);
    };
    
    reader.readAsText(envFile);
  };

  useEffect(() => {
    if (envFile) {
      parseEnvFile();
    }
  }, [envFile]);

  const handleUploadEnvSecrets = async () => {
    if (!selectedRepo || parsedEnvContent.length === 0) return;
    
    setIsEnvUploading(true);
    setError('');
    setNotification('');
    
    try {
      const publicKeyData = await fetchPublicKey(selectedRepo, githubToken);
      if (!publicKeyData) {
        setError("Failed to fetch public key, cannot upload secrets.");
        setIsEnvUploading(false);
        return;
      }
      
      // Upload each secret from the .env file
      for (const secret of parsedEnvContent) {
        await updateRepositorySecret(selectedRepo, githubToken, secret.name, secret.value);
      }
      
      loadSecrets();
      setNotification(`Successfully uploaded ${parsedEnvContent.length} secrets from .env file!`);
      setIsEnvUploadOpen(false);
      setEnvFile(null);
      setParsedEnvContent([]);
    } catch (err) {
      setError(`Failed to upload .env secrets: ${err.message}`);
      console.error(err);
    } finally {
      setIsEnvUploading(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="container">
        <div className="app-header">
          <div className="header-content">
            <h1 className="app-title">
              <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
              </svg>
              GitHub Secrets Manager
            </h1>
          </div>
        </div>
        <div className="auth-card">
          <h2>Authentication</h2>
          {error && <div className="notification error">{error}</div>}
          <form onSubmit={handleSubmit(handleAuth)}>
            <div className="form-group">
              <label htmlFor="token">GitHub Personal Access Token:</label>
              <input
                type="password"
                id="token"
                placeholder="ghp_***************************************"
                {...register("token", { required: "GitHub token is required" })}
                className={errors.token ? 'input-error' : ''}
              />
              {errors.token && <p className="error-message">{errors.token.message}</p>}
            </div>
            <button type="submit" className="btn-primary" style={{width: '100%'}} disabled={loading}>
              {loading ? 'Validating...' : 'Connect to GitHub'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="app-header">
        <div className="header-content">
          <h1 className="app-title">
            <svg width="24" height="24" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
            </svg>
            GitHub Secrets Manager
          </h1>
        </div>
      </div>
      
      <div className="dashboard-container">
        {notification && <div className="notification success">{notification}</div>}
        {error && <div className="notification error">{error}</div>}

        <div className="controls">
          <div className="repo-selector">
            <label htmlFor="repo">Select Repository:</label>
            <select id="repo" value={selectedRepo} onChange={handleRepoChange} disabled={loading}>
              <option value="">Choose a repository...</option>
              {repos.map((repo) => (
                <option key={repo.id} value={repo.full_name}>
                  {repo.full_name}
                </option>
              ))}
            </select>
          </div>

          <div className="search-bar">
            <input
              type="text"
              placeholder="Search secrets..."
              value={searchQuery}
              onChange={handleSearchChange}
              disabled={loading || !selectedRepo}
            />
          </div>
        </div>

        {selectedRepo && (
          <div className="secrets-actions">
            <button onClick={openAddSecretModal} className="btn-primary" disabled={loading}>
              + Add Secret
            </button>
            <button onClick={() => setIsImportOpen(true)} className="btn-secondary" disabled={loading}>
              Import JSON
            </button>
            <button onClick={() => setIsEnvUploadOpen(true)} className="btn-secondary" disabled={loading}>
              Upload .env
            </button>
            <button 
              onClick={() => setIsExportOpen(true)} 
              className="btn-outline"
              disabled={loading || secrets.length === 0}
            >
              Export Secrets
            </button>
            <button 
              onClick={handleBulkDeleteConfirmation} 
              className="btn-danger"
              disabled={loading || secrets.length === 0}
            >
              Delete All Secrets
            </button>
          </div>
        )}

        {loading && (
          <div className="loading">
            <div className="spinner"></div>
            Loading...
          </div>
        )}

        {selectedRepo && secrets.length > 0 && !loading && (
          <div className="secrets-list">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Last Modified</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredSecrets.map((secret) => (
                  <tr key={secret.name}>
                    <td><strong>{secret.name}</strong></td>
                    <td>{new Date(secret.updated_at).toLocaleDateString()}</td>
                    <td className="actions-cell">
                      <button onClick={() => openEditSecretModal(secret)} className="btn-outline" disabled={loading}>Edit</button>
                      <button onClick={() => handleDeleteSecretConfirmation(secret.name)} className="btn-danger" disabled={loading}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {selectedRepo && secrets.length === 0 && !loading && (
          <div className="empty-state">
            <svg aria-hidden="true" height="24" viewBox="0 0 24 24" version="1.1" width="24" data-view-component="true">
              <path fill="currentColor" d="M3.5 3.75a.25.25 0 01.25-.25h13.5a.25.25 0 01.25.25v10a.75.75 0 001.5 0v-10A1.75 1.75 0 0017.25 2H3.75A1.75 1.75 0 002 3.75v16.5c0 .966.784 1.75 1.75 1.75h7a.75.75 0 000-1.5h-7a.25.25 0 01-.25-.25V3.75z"></path><path fill="currentColor" d="M6.25 7a.75.75 0 000 1.5h8.5a.75.75 0 000-1.5h-8.5zm-.75 4.75a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5a.75.75 0 01-.75-.75zm16.28 4.53a.75.75 0 10-1.06-1.06l-4.97 4.97-1.97-1.97a.75.75 0 10-1.06 1.06l2.5 2.5a.75.75 0 001.06 0l5.5-5.5z"></path>
            </svg>
            {searchQuery ? (
              <p>No secrets found matching "{searchQuery}"</p>
            ) : (
              <>
                <p>No secrets found in this repository</p>
                <button onClick={openAddSecretModal} className="btn-primary" disabled={loading}>
                  Add Your First Secret
                </button>
              </>
            )}
          </div>
        )}

        {/* Add Secret Modal */}
        {isAddSecretOpen && (
          <div className="modal">
            <div className="modal-content">
              <button className="close-button" onClick={closeAddSecretModal}>×</button>
              <h2>Add New Secret</h2>
              <form onSubmit={handleSubmit(handleAddSecret)}>
                <div className="form-group">
                  <label htmlFor="secretName">Secret Name:</label>
                  <input 
                    type="text" 
                    id="secretName" 
                    placeholder="SECRET_NAME"
                    {...register("secretName", { 
                      required: "Secret name is required",
                      pattern: {
                        value: /^[A-Z0-9_]+$/,
                        message: "Secret names should use uppercase letters, numbers and underscores only"
                      }
                    })} 
                    className={errors.secretName ? 'input-error' : ''} 
                  />
                  {errors.secretName && <p className="error-message">{errors.secretName.message}</p>}
                </div>
                <div className="form-group">
                  <label htmlFor="secretValue">Secret Value:</label>
                  <textarea 
                    id="secretValue" 
                    placeholder="Enter the value of your secret here"
                    {...register("secretValue", { required: "Secret value is required" })} 
                    className={errors.secretValue ? 'input-error' : ''} 
                  />
                  {errors.secretValue && <p className="error-message">{errors.secretValue.message}</p>}
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={closeAddSecretModal} className="btn-outline" disabled={loading}>Cancel</button>
                  <button type="submit" className="btn-primary" disabled={loading}>Add Secret</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Secret Modal */}
        {isEditSecretOpen && secretToEdit && (
          <div className="modal">
            <div className="modal-content">
              <button className="close-button" onClick={closeEditSecretModal}>×</button>
              <h2>Edit Secret: {secretToEdit.name}</h2>
              <form onSubmit={handleSubmit(handleModifySecret)}>
                <div className="form-group">
                  <label htmlFor="secretName">Secret Name:</label>
                  <input 
                    type="text" 
                    id="secretName" 
                    {...register("secretName", { required: "Secret name is required" })} 
                    className="input-disabled"
                    defaultValue={secretToEdit.name} 
                    readOnly 
                  />
                  <p className="help-text">Secret names cannot be changed. Create a new secret if needed.</p>
                </div>
                <div className="form-group">
                  <label htmlFor="secretValue">New Secret Value:</label>
                  <textarea 
                    id="secretValue" 
                    placeholder="Enter new value for this secret"
                    {...register("secretValue", { required: "Secret value is required" })} 
                    className={errors.secretValue ? 'input-error' : ''} 
                  />
                  {errors.secretValue && <p className="error-message">{errors.secretValue.message}</p>}
                </div>
                <div className="modal-actions">
                  <button type="button" onClick={closeEditSecretModal} className="btn-outline" disabled={loading}>Cancel</button>
                  <button type="submit" className="btn-secondary" disabled={loading}>Update Secret</button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {isDeleteConfirmationOpen && (
          <div className="confirmation-modal">
            <div className="confirmation-content">
              <div className="confirmation-icon">⚠️</div>
              <h2>Delete Secret</h2>
              <p>Are you sure you want to delete secret <strong>"{secretToDelete}"</strong>?</p>
              <p>This action cannot be undone.</p>
              <div className="confirmation-actions">
                <button onClick={() => setIsDeleteConfirmationOpen(false)} className="btn-outline" disabled={loading}>Cancel</button>
                <button onClick={handleDeleteSecret} className="btn-danger" disabled={loading}>Delete Secret</button>
              </div>
            </div>
          </div>
        )}

        {/* Bulk Delete Confirmation Modal */}
        {isBulkDeleteConfirmationOpen && (
          <div className="confirmation-modal">
            <div className="confirmation-content">
              <div className="confirmation-icon">⚠️</div>
              <h2>Delete All Secrets</h2>
              <p>Are you sure you want to delete <strong>ALL {secrets.length} secrets</strong> from <strong>{selectedRepo}</strong>?</p>
              <p>This action cannot be undone.</p>
              <div className="confirmation-actions">
                <button onClick={() => setIsBulkDeleteConfirmationOpen(false)} className="btn-outline" disabled={loading}>Cancel</button>
                <button onClick={handleBulkDeleteSecrets} className="btn-danger" disabled={loading}>
                  Delete All Secrets
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Import Secrets Modal */}
        {isImportOpen && (
          <div className="modal">
            <div className="modal-content">
              <button className="close-button" onClick={() => setIsImportOpen(false)}>×</button>
              <h2>Import Secrets from JSON</h2>
              <div className="import-export-area">
                <p>Select a JSON file with an array of secret objects. Each object should have a "name" and "value" property.</p>
                <input
                  type="file"
                  accept=".json"
                  onChange={(e) => setImportFile(e.target.files[0])}
                  disabled={loading}
                />
                <div className="file-info">
                  {importFile && <span>Selected: {importFile.name}</span>}
                </div>
                <div className="modal-actions">
                  <button onClick={() => setIsImportOpen(false)} className="btn-outline" disabled={loading}>Cancel</button>
                  <button onClick={handleImportSecrets} className="btn-primary" disabled={loading || !importFile}>Import</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Export Secrets Modal */}
        {isExportOpen && (
          <div className="modal">
            <div className="modal-content">
              <button className="close-button" onClick={() => setIsExportOpen(false)}>×</button>
              <h2>Export Secrets</h2>
              <div className="import-export-area">
                <p>Export all secrets from <strong>{selectedRepo}</strong> to a JSON file.</p>
                <p className="note">Note: Secret values cannot be exported for security reasons, only names and timestamps.</p>
                <div className="modal-actions">
                  <button onClick={() => setIsExportOpen(false)} className="btn-outline" disabled={loading}>Cancel</button>
                  {!exportedSecrets ? (
                    <button onClick={handleExportSecrets} className="btn-primary" disabled={loading}>
                      Prepare Export
                    </button>
                  ) : (
                    <button onClick={downloadExportedSecrets} className="btn-secondary" disabled={loading}>
                      <span>Download JSON</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* .env File Upload Modal */}
        {isEnvUploadOpen && (
          <div className="modal">
            <div className="modal-content">
              <button className="close-button" onClick={() => {
                setIsEnvUploadOpen(false);
                setEnvFile(null);
                setParsedEnvContent([]);
              }}>×</button>
              <h2>Upload .env File</h2>
              <div className="import-export-area">
                <p>Upload a .env file to convert its contents to GitHub secrets.</p>
                <input
                  type="file"
                  accept=".env"
                  onChange={handleEnvFileUpload}
                  disabled={isEnvUploading}
                />
                
                {parsedEnvContent.length > 0 && (
                  <>
                    <div className="parsed-env-preview">
                      <h3>Found {parsedEnvContent.length} secrets</h3>
                      <table>
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Value Preview</th>
                          </tr>
                        </thead>
                        <tbody>
                          {parsedEnvContent.map((secret, idx) => (
                            <tr key={idx}>
                              <td><strong>{secret.name}</strong></td>
                              <td>{secret.value.length > 15 ? secret.value.substring(0, 15)+'••••' : secret.value.substring(0, 3)+'••••'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="modal-actions">
                      <button 
                        onClick={() => {
                          setIsEnvUploadOpen(false);
                          setEnvFile(null);
                          setParsedEnvContent([]);
                        }} 
                        className="btn-outline"
                        disabled={isEnvUploading}
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={handleUploadEnvSecrets} 
                        className="btn-primary"
                        disabled={isEnvUploading || parsedEnvContent.length === 0}
                      >
                        {isEnvUploading ? (
                          <>
                            <div className="spinner"></div>
                            Uploading...
                          </>
                        ) : (
                          `Upload ${parsedEnvContent.length} Secrets`
                        )}
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

export default App;
