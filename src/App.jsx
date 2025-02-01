import React, { useState, useEffect, useRef } from 'react';
    import './App.css';

    function App() {
      const [transcription, setTranscription] = useState('');
      const [isRecording, setIsRecording] = useState(false);
      const [uploadStatus, setUploadStatus] = useState([]);
      const [clinicLetter, setClinicLetter] = useState({
        chiefComplaint: 'Patient presents with...',
        historyOfPresentIllness: 'The patient reports...',
        assessmentAndPlan: 'Based on the above, the plan is...'
      });
      const mediaRecorder = useRef(null);
      const audioChunks = useRef([]);
      const streamRef = useRef(null);
      const audioUrl = useRef(null);
      const apiKey = 'fQxsqtjOjLsXOrzCgyRAJGjXcYvLpjW1'; // Updated API key
      const jobId = useRef(null);

      const handleEditLetter = (field, value) => {
        setClinicLetter(prev => ({ ...prev, [field]: value }));
      };

      const extractMedicalDetails = (text) => {
        // This is a placeholder for actual NLP processing
        const chiefComplaint = text.includes('headache') ? 'Patient complains of headache.' : 'Patient presents with general symptoms.';
        const historyOfPresentIllness = text.includes('fever') ? 'Patient reports fever for 2 days.' : 'Patient reports no fever.';
        const assessmentAndPlan = text.includes('rest') ? 'Advise rest and hydration.' : 'Further evaluation needed.';

        setClinicLetter({
          chiefComplaint,
          historyOfPresentIllness,
          assessmentAndPlan
        });
      };

      useEffect(() => {
        extractMedicalDetails(transcription);
      }, [transcription]);

      useEffect(() => {
        if (isRecording) {
          navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
              streamRef.current = stream;
              mediaRecorder.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
              mediaRecorder.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                  audioChunks.current.push(event.data);
                }
              };
              mediaRecorder.current.onstop = () => {
                const audioBlob = new Blob(audioChunks.current, { type: 'audio/webm' });
                audioChunks.current = [];
                const url = URL.createObjectURL(audioBlob);
                audioUrl.current = url;
              };
              mediaRecorder.current.start(200);
            })
            .catch(error => {
              console.error('Error accessing microphone:', error);
            });
        } else if (mediaRecorder.current && mediaRecorder.current.state === 'recording') {
            mediaRecorder.current.stop();
            if (streamRef.current) {
              streamRef.current.getTracks().forEach(track => track.stop());
            }
        }
      }, [isRecording]);

      const toggleRecording = () => {
        setIsRecording(!isRecording);
      };

      const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setUploadStatus(prev => [...prev, 'Uploading: File selected.']);

        const reader = new FileReader();
        reader.onload = async (e) => {
          setUploadStatus(prev => [...prev, 'Uploading: File read.']);
          try {
            setUploadStatus(prev => [...prev, 'Uploading: Sending file to API...']);
            const uploadResponse = await fetch('https://api.speechmatics.com/v2/jobs', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${apiKey}`,
              },
              body: file
            });

            if (!uploadResponse.ok) {
              const errorText = await uploadResponse.text();
              setUploadStatus(prev => [...prev, `Uploading: File upload failed: ${uploadResponse.status} - ${errorText}`]);
              return;
            }

            const uploadData = await uploadResponse.json();
            jobId.current = uploadData.id;
            setUploadStatus(prev => [...prev, `Uploading: File uploaded successfully. Job ID: ${jobId.current}`]);

            const pollForResults = async () => {
              setUploadStatus(prev => [...prev, 'Uploading: Polling for results...']);
              try {
                const jobStatusResponse = await fetch(`https://api.speechmatics.com/v2/jobs/${jobId.current}`, {
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                  }
                });

                if (!jobStatusResponse.ok) {
                  const errorText = await jobStatusResponse.text();
                  setUploadStatus(prev => [...prev, `Uploading: Error polling job status: ${jobStatusResponse.status} - ${errorText}`]);
                  return;
                }

                const jobStatusData = await jobStatusResponse.json();
                setUploadStatus(prev => [...prev, `Uploading: Job status: ${jobStatusData.status}`]);

                if (jobStatusData.status === 'done') {
                  setUploadStatus(prev => [...prev, 'Uploading: Job completed. Fetching transcript...']);
                  const transcriptResponse = await fetch(`https://api.speechmatics.com/v2/jobs/${jobId.current}/transcript`, {
                    headers: {
                      'Authorization': `Bearer ${apiKey}`,
                    }
                  });

                  if (!transcriptResponse.ok) {
                    const errorText = await transcriptResponse.text();
                    setUploadStatus(prev => [...prev, `Uploading: Error fetching transcript: ${transcriptResponse.status} - ${errorText}`]);
                    return;
                  }

                  const transcriptData = await transcriptResponse.json();
                  const transcript = transcriptData.results.reduce((acc, result) => acc + result.alternatives[0].transcript, '');
                  const timestamp = new Date().toLocaleTimeString();
                  setTranscription(prev => prev + `[${timestamp}] ${transcript} `);
                  setUploadStatus(prev => [...prev, 'Uploading: Transcription complete.']);
                  return;
                } else if (jobStatusData.status === 'failed') {
                  setUploadStatus(prev => [...prev, 'Uploading: Job failed.']);
                  return;
                } else {
                  setTimeout(pollForResults, 5000); // Poll every 5 seconds
                }
              } catch (error) {
                setUploadStatus(prev => [...prev, `Uploading: Error during polling: ${error.message}`]);
              }
            };

            pollForResults();

          } catch (error) {
            console.error('Error processing audio file:', error);
            setUploadStatus(prev => [...prev, `Uploading: Error processing audio file: ${error.message}`]);
          }
        };
        reader.onerror = () => {
          setUploadStatus(prev => [...prev, 'Uploading: Error reading file.']);
        };
        reader.readAsArrayBuffer(file);
      };

      const handleSave = () => {
        console.log('Saving clinic letter:', clinicLetter);
        // Here you would typically save the data to a database or send it to an API
      };

      return (
        <div className="app-container">
          <h1>Doctor-Patient Conversation Capture</h1>
          <div className="panels">
            <div className="transcription-panel">
              <h2>Live Transcription</h2>
              <button onClick={toggleRecording}>{isRecording ? 'Stop Recording' : 'Start Recording'}</button>
              <p>{transcription}</p>
              {audioUrl.current && <audio src={audioUrl.current} controls />}
              <input type="file" accept=".wav,.mp3" onChange={handleFileUpload} />
              <div className="status-box">
                {uploadStatus.map((status, index) => (
                  <p key={index}>{status}</p>
                ))}
              </div>
            </div>
            <div className="letter-panel">
              <h2>Clinic Letter</h2>
              <div className="letter-section">
                <h3>Chief Complaint</h3>
                <textarea value={clinicLetter.chiefComplaint} onChange={e => handleEditLetter('chiefComplaint', e.target.value)} />
              </div>
              <div className="letter-section">
                <h3>History of Present Illness</h3>
                <textarea value={clinicLetter.historyOfPresentIllness} onChange={e => handleEditLetter('historyOfPresentIllness', e.target.value)} />
              </div>
              <div className="letter-section">
                <h3>Assessment and Plan</h3>
                <textarea value={clinicLetter.assessmentAndPlan} onChange={e => handleEditLetter('assessmentAndPlan', e.target.value)} />
              </div>
              <button onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      );
    }

    export default App;
