// =========================================================
// LEER UNA IMAGEN SUBIDA POR EL ADMINISTRADOR
// Se reduce en el navegador para que no pese demasiado
// en la base de datos. Devuelve un "data URL".
// =========================================================

const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

export function readImage(file, { maxSize = 600, keepPng = true } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se eligió ninguna imagen'));
      return;
    }

    if (!TYPES.includes(file.type)) {
      reject(new Error('Elige una imagen PNG, JPG, WEBP o GIF'));
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      reject(new Error('La imagen pesa más de 8 MB'));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));

    reader.onload = () => {
      const img = new Image();

      img.onerror = () => reject(new Error('El archivo no es una imagen válida'));

      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));

        // Imagen pequeña y liviana: se guarda tal cual
        if (scale === 1 && file.size < 900 * 1024) {
          resolve(reader.result);
          return;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);

        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingQuality = 'high';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        resolve(
          keepPng && file.type === 'image/png'
            ? canvas.toDataURL('image/png')
            : canvas.toDataURL('image/jpeg', 0.88)
        );
      };

      img.src = reader.result;
    };

    reader.readAsDataURL(file);
  });
}
