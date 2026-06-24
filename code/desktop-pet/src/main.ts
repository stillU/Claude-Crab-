window.addEventListener("DOMContentLoaded", () => {
  const canvas = document.getElementById("pet-canvas") as HTMLCanvasElement;
  if (canvas) {
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    console.log("Desktop pet canvas initialized");
  }
});
