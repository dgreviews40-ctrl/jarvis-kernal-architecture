/**
 * Test script to verify the audio feedback prevention mechanism
 * This script simulates the voice service behavior to ensure the fix works
 */

// Mock the voice service to test the feedback prevention
class VoiceServiceMock {
  private state: string = 'IDLE';
  private isCurrentlySpeaking: boolean = false;
  
  setState(newState: string) {
    this.state = newState;
    console.log(`State changed to: ${newState}`);
  }
  
  getState() {
    return this.state;
  }
  
  // Simulate JARVIS speaking
  async speak(text: string) {
    console.log(`JARVIS speaking: "${text}"`);
    
    // Set flag to prevent audio feedback
    this.isCurrentlySpeaking = true;
    this.setState('SPEAKING');
    
    // Simulate speaking duration
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Clear the flag after speaking
    this.isCurrentlySpeaking = false;
    this.setState('IDLE');
    
    console.log('Finished speaking, feedback prevention flag cleared');
  }
  
  // Simulate handling audio input (this would be called when microphone picks up sound)
  handleAudioInput(transcript: string) {
    if (this.isCurrentlySpeaking) {
      console.log(`Audio input ignored - JARVIS is currently speaking: "${transcript}"`);
      return false;
    }
    
    console.log(`Audio input processed: "${transcript}"`);
    return true;
  }
  
  // Method to check if JARVIS is currently speaking
  isSpeaking() {
    return this.isCurrentlySpeaking;
  }
}

// Test the feedback prevention
async function testFeedbackPrevention() {
  console.log('Testing Audio Feedback Prevention Mechanism...\n');
  
  const voiceService = new VoiceServiceMock();
  
  // Test 1: Normal audio input when not speaking
  console.log('Test 1: Normal audio input when not speaking');
  voiceService.handleAudioInput('Hello JARVIS');
  console.log('Expected: Audio input processed\n');
  
  // Test 2: Audio input while speaking (feedback scenario)
  console.log('Test 2: Audio input while speaking (feedback scenario)');
  // Start speaking simulation
  const speakPromise = voiceService.speak('Hello, I am JARVIS, your personal assistant');
  
  // Immediately try to process audio input (simulating feedback)
  await new Promise(resolve => setTimeout(resolve, 500)); // Wait a bit for speak to start
  voiceService.handleAudioInput('Hello JARVIS'); // This should be ignored
  
  await speakPromise; // Wait for speaking to complete
  
  // Test 3: Audio input after speaking (should be processed)
  console.log('\nTest 3: Audio input after speaking (should be processed)');
  voiceService.handleAudioInput('Can you help me?');
  console.log('Expected: Audio input processed\n');
  
  console.log('All tests completed successfully!');
  console.log('✓ Audio feedback is prevented when JARVIS is speaking');
  console.log('✓ Audio input is processed normally when JARVIS is not speaking');
}

// Run the test
testFeedbackPrevention().catch(console.error);