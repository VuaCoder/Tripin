import 'dart:io';
import 'package:dio/dio.dart';

class CloudinaryUploadResult {
  final String publicId;
  final String secureUrl;

  CloudinaryUploadResult({required this.publicId, required this.secureUrl});
}

class CloudinaryService {
  final Dio _dio = Dio();

  Future<CloudinaryUploadResult> uploadImageWithSignature({
    required File file,
    required Map<String, dynamic> signatureData,
  }) async {
    final uploadUrl = signatureData['uploadUrl'] as String;
    final apiKey = signatureData['apiKey'] as String;
    final timestamp = signatureData['timestamp'].toString();
    final signature = signatureData['signature'] as String;
    final publicId = signatureData['publicId'] as String;
    final params = signatureData['params'] as Map<String, dynamic>? ?? {};

    final fileName = file.path.split(Platform.pathSeparator).last;

    final formData = FormData.fromMap({
      'file': await MultipartFile.fromFile(file.path, filename: fileName),
      'api_key': apiKey,
      'timestamp': timestamp,
      'signature': signature,
      'public_id': publicId,
      if (params.containsKey('tags')) 'tags': params['tags'],
      if (params.containsKey('overwrite')) 'overwrite': params['overwrite'],
    });

    final response = await _dio.post(uploadUrl, data: formData);

    if (response.statusCode == 200 && response.data != null) {
      final resData = response.data as Map<String, dynamic>;
      return CloudinaryUploadResult(
        publicId: resData['public_id'] as String? ?? publicId,
        secureUrl: resData['secure_url'] as String? ?? '',
      );
    } else {
      throw Exception('Tải ảnh lên Cloudinary thất bại (HTTP ${response.statusCode})');
    }
  }
}