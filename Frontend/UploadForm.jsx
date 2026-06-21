import { useState } from "react";
import axios from "axios";

function UploadForm() {
  const [file, setFile] = useState(null);

  const handleUpload = async () => {
    if (!file) {
      alert("Select a PDF first");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await axios.post(
        "http://127.0.0.1:8000/upload",
        formData
      );

      console.log(response.data);
      alert("Upload Successful!");
    } catch (error) {
      console.error(error);
      alert("Upload Failed!");
    }
  };

  return (
    <div>
      <h2>Upload PDF</h2>

      <input
        type="file"
        accept=".pdf"
        onChange={(e) => setFile(e.target.files[0])}
      />

      <button onClick={handleUpload}>
        Upload
      </button>
    </div>
  );
}

export default UploadForm;