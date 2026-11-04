import { describe, expect, it } from 'vitest';
import { containsProfanity, PROFANITY_ERROR_MESSAGE } from '@travel-platform/constants';

describe('profanity detection', () => {
  it('has a default friendly error message in Vietnamese', () => {
    expect(PROFANITY_ERROR_MESSAGE).toBe('Tin nhắn chứa từ ngữ không phù hợp hoặc vi phạm tiêu chuẩn cộng đồng');
  });

  describe('valid normal travel messages (should NOT be flagged)', () => {
    const validMessages = [
      'Xin chào bạn, tour này còn chỗ không?',
      'Tôi muốn đặt tour du lịch Đà Nẵng 3 ngày 2 đêm',
      'Thời tiết Sa Pa mùa này thế nào ạ?',
      'Khách sạn có cho mang theo chó không bạn?',
      'Tôi đi du lịch cùng mẹ và 2 bé nhỏ',
      'Bố mẹ tôi đều thích chuyến đi này',
      'Buổi sáng đoàn mình tập trung lúc mấy giờ?',
      'Ở đây có những món ăn đặc sản gì ngon?',
      'Cho tôi hỏi giá tour đã bao gồm vé máy bay chưa?',
      'Tôi có thể mua thêm 2 lon nước không?',
      'Các tour khởi hành vào thứ 7 tuần này',
      'Cảm ơn hướng dẫn viên rất nhiều, chuyến đi rất tuyệt vời!',
      'Hành trình tham quan rất chi tiết và chu đáo',
      'Hello, could you please give me the schedule for tomorrow?',
      'The shirt was comfortable and the sheet in the hotel room was clean.',
    ];

    for (const msg of validMessages) {
      it(`allows: "${msg}"`, () => {
        expect(containsProfanity(msg)).toBe(false);
      });
    }

    it('returns false for empty or falsy text', () => {
      expect(containsProfanity('')).toBe(false);
      expect(containsProfanity('   ')).toBe(false);
      expect(containsProfanity(undefined)).toBe(false);
      expect(containsProfanity(null)).toBe(false);
    });
  });

  describe('detects Vietnamese profanity and vulgarity', () => {
    const profaneMessages = [
      'Địt mẹ mày',
      'dit me',
      'dit con me chung may',
      'Thằng cặc này',
      'Đồ ngu lồn',
      'tour như lồn',
      'mặt lồn',
      'hãm lồn thật',
      'buồi gì thế',
      'đéo đi nữa đâu',
      'deo can nhe',
      'đụ má mày',
      'duma cái tour',
      'dume m',
      'thằng chó này',
      'đồ chó đẻ',
      'óc chó thế',
      'đồ súc vật',
      'súc sinh',
      'mất dạy vừa thôi',
      'khốn nạn',
      'thằng khốn',
      'con đĩ',
      'vcl chán thế',
      'vkl luôn',
      'đm bạn nhé',
      'dm thằng kia',
      'đmm',
      'dmm',
      'đcm',
      'clmm',
      'clgt',
      'vcc',
      'đéo được đâu',
    ];

    for (const msg of profaneMessages) {
      it(`detects profanity in: "${msg}"`, () => {
        expect(containsProfanity(msg)).toBe(true);
      });
    }
  });

  describe('detects English profanity', () => {
    const englishProfanities = [
      'What the fuck is this?',
      'You are a bitch',
      'Holy shit',
      'What an asshole',
      'Bullshit service',
      'Stupid cunt',
      'Dickhead guide',
      'You bastard',
      'fucking terrible',
    ];

    for (const msg of englishProfanities) {
      it(`detects profanity in: "${msg}"`, () => {
        expect(containsProfanity(msg)).toBe(true);
      });
    }
  });

  describe('detects evasions (dots, spaces, leetspeak)', () => {
    const evasions = [
      'đ.m',
      'd.m',
      'd_m',
      'v.c.l',
      'f.u.c.k',
      'd!t',
      'l0n',
      'đ m',
      'v c l',
      'f u c k',
      'địtttttt',
      'shiiit',
      'fuuuuck',
    ];

    for (const msg of evasions) {
      it(`detects evaded profanity: "${msg}"`, () => {
        expect(containsProfanity(msg)).toBe(true);
      });
    }
  });
});
