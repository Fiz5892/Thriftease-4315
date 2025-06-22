import { json, ActionFunction, LoaderFunction } from "@remix-run/node";
import { PrismaClient } from "@prisma/client";
import { v2 as cloudinary } from 'cloudinary';

const prisma = new PrismaClient();

// Konfigurasi Cloudinary dengan validasi
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Validasi konfigurasi Cloudinary
const validateCloudinaryConfig = () => {
  if (!process.env.CLOUDINARY_CLOUD_NAME || 
      !process.env.CLOUDINARY_API_KEY || 
      !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary configuration missing. Please check environment variables.');
  }
};

// Helper function untuk upload ke Cloudinary dengan enhanced options
async function uploadToCloudinary(file: File): Promise<{ url: string; publicId: string }> {
  validateCloudinaryConfig();
  
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  
  // Validasi ukuran file (maksimal 10MB)
  if (buffer.length > 10 * 1024 * 1024) {
    throw new Error('File terlalu besar. Maksimal 10MB per file.');
  }
  
  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload_stream(
      {
        resource_type: "image",
        folder: "thrift-products",
        use_filename: true,
        unique_filename: true,
        transformation: [
          { width: 1200, height: 1200, crop: "limit" }, // Ukuran lebih besar untuk kualitas
          { quality: "auto:good" }, // Kualitas yang lebih baik
          { format: "auto" }, // Auto format (WebP, AVIF, dll)
          { fetch_format: "auto" } // Optimasi delivery format
        ],
        // Tags untuk organizasi yang lebih baik
        tags: ['thrift', 'product', 'ecommerce'],
        // Context untuk metadata tambahan
        context: {
          caption: "Thrift product image",
          alt: file.name
        }
      },
      (error, result) => {
        if (error) {
          console.error('Cloudinary upload error:', error);
          reject(new Error(`Upload gagal: ${error.message}`));
        } else if (result) {
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          });
        } else {
          reject(new Error('Upload gagal: Tidak ada response dari Cloudinary'));
        }
      }
    ).end(buffer);
  });
}

// Helper function untuk delete dari Cloudinary dengan improved error handling
async function deleteFromCloudinary(imageUrl: string): Promise<boolean> {
  try {
    validateCloudinaryConfig();
    
    // Extract public_id from URL dengan method yang lebih robust
    const urlParts = imageUrl.split('/');
    const uploadIndex = urlParts.findIndex(part => part === 'upload');
    
    if (uploadIndex === -1) {
      console.error('Invalid Cloudinary URL format:', imageUrl);
      return false;
    }
    
    // Ambil bagian setelah /upload/v{version}/
    const pathAfterUpload = urlParts.slice(uploadIndex + 2).join('/');
    const publicId = pathAfterUpload.split('.')[0]; // Remove file extension
    
    const result = await cloudinary.uploader.destroy(publicId);
    
    if (result.result === 'ok' || result.result === 'not found') {
      return true;
    } else {
      console.error('Failed to delete from Cloudinary:', result);
      return false;
    }
  } catch (error) {
    console.error('Error deleting from Cloudinary:', error);
    return false;
  }
}

// Helper function untuk bulk delete
async function bulkDeleteFromCloudinary(imageUrls: string[]): Promise<void> {
  const deletePromises = imageUrls.map(url => deleteFromCloudinary(url));
  await Promise.allSettled(deletePromises);
}

export const loader: LoaderFunction = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    
    if (id) {
      const product = await prisma.product.findUnique({
        where: { id },
        include: { images: true },
      });
      
      if (!product) {
        return json({ error: "Produk tidak ditemukan" }, { status: 404 });
      }
      
      return json({ product });
    }
    
    const products = await prisma.product.findMany({
      include: { images: true },
      orderBy: { createdAt: 'desc' }, // Order by newest first
    });
    
    return json({ products });
  } catch (error) {
    console.error('Loader error:', error);
    return json({ error: "Gagal memuat data produk" }, { status: 500 });
  }
};

// Helper untuk batch upload dengan progress tracking
async function batchUploadToCloudinary(files: File[]): Promise<{ url: string; publicId: string }[]> {
  const results: { url: string; publicId: string }[] = [];
  const errors: string[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (file.size > 0) {
      try {
        console.log(`Uploading image ${i + 1}/${files.length}: ${file.name}`);
        const result = await uploadToCloudinary(file);
        results.push(result);
        console.log(`✓ Successfully uploaded ${file.name}`);
      } catch (error) {
        const errorMsg = `Failed to upload ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        console.error(errorMsg);
        errors.push(errorMsg);
        
        // Cleanup pada error pertama
        if (results.length > 0) {
          console.log('Cleaning up previously uploaded images...');
          await bulkDeleteFromCloudinary(results.map(r => r.url));
        }
        
        throw new Error(`Upload gagal pada file ${file.name}. ${errors.join(', ')}`);
      }
    }
  }
  
  return results;
}

export const action: ActionFunction = async ({ request }) => {
  const method = request.method;
  const formData = await request.formData();
  
  switch (method) {
    case "POST": {
      try {
        // Validasi konfigurasi Cloudinary di awal
        validateCloudinaryConfig();
        
        // Ambil data form
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const size = formData.get("size") as string;
        const price = parseFloat(formData.get("price") as string);
        const stock = parseInt(formData.get("stock") as string);
        const category = formData.get("category") as string;
        const images = formData.getAll("images[]") as File[];
        
        // Validasi input yang lebih comprehensive
        const validationErrors: string[] = [];
        
        if (!name?.trim()) validationErrors.push("Nama produk harus diisi");
        if (!description?.trim()) validationErrors.push("Deskripsi produk harus diisi");
        if (!size?.trim()) validationErrors.push("Ukuran produk harus diisi");
        if (!category?.trim()) validationErrors.push("Kategori produk harus diisi");
        if (isNaN(price) || price < 0) validationErrors.push("Harga harus berupa angka positif");
        if (isNaN(stock) || stock < 0) validationErrors.push("Stok harus berupa angka positif");
        
        // Validasi gambar
        if (images.length > 10) {
          validationErrors.push("Maksimal 10 gambar per produk");
        }
        
        const validImages = images.filter(img => img.size > 0);
        if (validImages.length === 0) {
          validationErrors.push("Minimal 1 gambar produk harus diupload");
        }
        
        if (validationErrors.length > 0) {
          return json({ 
            error: "Validasi gagal",
            details: validationErrors.join(", ")
          }, { status: 400 });
        }
        
        // Batch upload gambar ke Cloudinary dengan better error handling
        console.log(`Starting batch upload of ${validImages.length} images...`);
        const uploadedImages = await batchUploadToCloudinary(validImages);
        console.log(`✓ All ${uploadedImages.length} images uploaded successfully`);
        
        // Simpan ke database dengan transaction
        const product = await prisma.$transaction(async (tx) => {
          const newProduct = await tx.product.create({
            data: {
              name: name.trim(),
              description: description.trim(),
              size: size.trim(),
              price,
              stock,
              category: category.trim(),
            },
          });
          
          // Simpan image data
          if (uploadedImages.length > 0) {
            await tx.productImage.createMany({
              data: uploadedImages.map((img, index) => ({
                url: img.url,
                publicId: img.publicId,
                productId: newProduct.id,
                order: index, // Untuk maintain order gambar
              })),
            });
          }
          
          // Return product with images
          return await tx.product.findUnique({
            where: { id: newProduct.id },
            include: { 
              images: {
                orderBy: { order: "asc" }
              }
            },
          });
        });
        
        console.log(`✓ Product created successfully: ${product?.id} with ${uploadedImages.length} images`);
        
        return json({ 
          success: true,
          product, 
          message: "Produk berhasil ditambahkan ke Cloudinary dan database",
          stats: {
            imagesUploaded: uploadedImages.length,
            totalSize: validImages.reduce((sum, img) => sum + img.size, 0)
          }
        });
        
      } catch (error) {
        console.error('❌ Error creating product:', error);
        
        return json({ 
          error: "Gagal menambah produk",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
      }
    }
    
    case "PUT": {
      try {
        validateCloudinaryConfig();
        
        const id = formData.get("id") as string;
        const name = formData.get("name") as string;
        const description = formData.get("description") as string;
        const size = formData.get("size") as string;
        const price = parseFloat(formData.get("price") as string);
        const stock = parseInt(formData.get("stock") as string);
        const category = formData.get("category") as string;
     
        if (!id) {
          return json({ error: "ID produk diperlukan" }, { status: 400 });
        }
        
        // Validasi input
        if (!name?.trim() || !description?.trim() || !size?.trim() || 
            isNaN(price) || isNaN(stock) || !category?.trim()) {
          return json({ 
            error: "Semua field harus diisi dengan benar" 
          }, { status: 400 });
        }
        
        if (price < 0 || stock < 0) {
          return json({ 
            error: "Harga dan stok tidak boleh negatif" 
          }, { status: 400 });
        }
     
        // Proses gambar baru (jika ada)
        const images = formData.getAll("images[]") as File[];
        const uploadedImages: { url: string; publicId: string }[] = [];
     
        if (images.length > 0) {
          for (const image of images) {
            if (image.size > 0) {
              try {
                const uploadResult = await uploadToCloudinary(image);
                uploadedImages.push(uploadResult);
              } catch (uploadError) {
                console.error('Error uploading image:', uploadError);
                
                // Cleanup uploaded images on error
                if (uploadedImages.length > 0) {
                  await bulkDeleteFromCloudinary(uploadedImages.map(img => img.url));
                }
                
                return json({ 
                  error: uploadError instanceof Error ? uploadError.message : "Gagal mengupload gambar" 
                }, { status: 500 });
              }
            }
          }
        }
     
        // Update produk di database dengan transaction
        const updatedProduct = await prisma.$transaction(async (tx) => {
          await tx.product.update({
            where: { id },
            data: {
              name: name.trim(),
              description: description.trim(),
              size: size.trim(),
              price,
              stock,
              category: category.trim(),
            },
          });

          // Tambahkan gambar baru
          if (uploadedImages.length > 0) {
            await tx.productImage.createMany({
              data: uploadedImages.map((img) => ({
                url: img.url,
                publicId: img.publicId,
                productId: id,
              })),
            });
          }
          
          return await tx.product.findUnique({
            where: { id },
            include: { images: true },
          });
        });
     
        return json({ 
          product: updatedProduct, 
          message: "Produk berhasil diupdate",
          newImages: uploadedImages.length
        });
        
      } catch (error) {
        console.error('Error updating product:', error);
        return json({ 
          error: "Gagal memperbarui produk",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
      }
    }
    
    case "DELETE": {
      try {
        validateCloudinaryConfig();
        
        const id = formData.get("id") as string;
        
        if (!id) {
          return json({ error: "ID produk diperlukan" }, { status: 400 });
        }
        
        // Ambil data produk beserta gambar dalam transaction
        const result = await prisma.$transaction(async (tx) => {
          const product = await tx.product.findUnique({
            where: { id },
            include: { images: true },
          });
          
          if (!product) {
            throw new Error("Produk tidak ditemukan");
          }
          
          // Hapus produk dari database (cascade akan hapus images)
          await tx.product.delete({
            where: { id },
          });
          
          return product;
        });
        
        // Hapus gambar dari Cloudinary setelah berhasil hapus dari database
        if (result.images.length > 0) {
          console.log(`Deleting ${result.images.length} images from Cloudinary...`);
          const imageUrls = result.images.map(img => img.url);
          await bulkDeleteFromCloudinary(imageUrls);
        }
        
        return json({ 
          success: true, 
          message: "Produk berhasil dihapus",
          deletedImages: result.images.length
        });
        
      } catch (error) {
        console.error('Error deleting product:', error);
        
        if (error instanceof Error && error.message === "Produk tidak ditemukan") {
          return json({ error: error.message }, { status: 404 });
        }
        
        return json({ 
          error: "Gagal menghapus produk",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
      }
    }
    
    default:
      return json({ error: "Method tidak diizinkan" }, { status: 405 });
  }
};