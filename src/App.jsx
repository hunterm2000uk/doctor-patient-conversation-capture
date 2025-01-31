import React, { useState, useEffect, useRef } from 'react';
    import './App.css';

    function App() {
      const [transcription, setTranscription] = useState('');
      const [isRecording, setIsRecording] = useState(false);
      const [clinicLetter, setClinicLetter] = useState({
        chiefComplaint: 'Patient presents with...',
        historyOfPresentIllness: 'The patient reports...',
        assessmentAndPlan: 'Based on the above, the plan is...'
      });
      const mediaRecorder = useRef(null);
      const audioChunks = useRef([]);
      const streamRef = useRef(null);
      const audioUrl = useRef(null);

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
              mediaRecorder.current = new MediaRecorder(stream);
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
                // Placeholder for STT
                const timestamp = new Date().toLocaleTimeString();
                setTranscription(prev => prev + `[${timestamp}] ... (audio processed) ... `);
              };
              mediaRecorder.current.start();
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
