const mongoose = require('mongoose');
const TimeAttendance = require('./workspace-backend/models/TimeAttendance');

// Cấu hình kết nối MongoDB (thay đổi theo cấu hình của bạn)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/your_database_name';

async function checkAttendanceLog() {
    try {
        // Kết nối MongoDB
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Đã kết nối MongoDB thành công');

        // Lấy ngày hôm nay
        const today = new Date();
        const todayStart = new Date(today);
        todayStart.setHours(0, 0, 0, 0);

        const todayEnd = new Date(today);
        todayEnd.setHours(23, 59, 59, 999);

        console.log('\n🔍 === KIỂM TRA LOG CHẤM CÔNG HÔM NAY ===');
        console.log(`📅 Ngày: ${today.toLocaleDateString('vi-VN')}`);
        console.log(`⏰ Thời gian kiểm tra: ${today.toLocaleString('vi-VN')}`);

        // 1. Kiểm tra tổng số record hôm nay
        const todayRecords = await TimeAttendance.find({
            date: {
                $gte: todayStart,
                $lte: todayEnd
            }
        }).populate('user', 'fullname email employeeCode');

        console.log(`\n📊 Tổng số nhân viên đã chấm công hôm nay: ${todayRecords.length}`);

        if (todayRecords.length === 0) {
            console.log('❌ Không có ai chấm công hôm nay');
        } else {
            console.log('\n👥 Danh sách nhân viên đã chấm công:');
            console.log('─'.repeat(80));
            console.log('| Mã NV    | Tên nhân viên        | Check-in | Check-out | Số lần |');
            console.log('─'.repeat(80));

            todayRecords.forEach(record => {
                const employeeCode = record.employeeCode.padEnd(8);
                const fullname = (record.user?.fullname || 'Chưa có tên').padEnd(20);
                const checkIn = record.checkInTime ?
                    new Date(record.checkInTime).toLocaleTimeString('vi-VN') : '--:--';
                const checkOut = record.checkOutTime ?
                    new Date(record.checkOutTime).toLocaleTimeString('vi-VN') : '--:--';
                const totalChecks = record.totalCheckIns.toString().padStart(6);

                console.log(`| ${employeeCode} | ${fullname} | ${checkIn.padEnd(8)} | ${checkOut.padEnd(9)} | ${totalChecks} |`);
            });
            console.log('─'.repeat(80));
        }

        // 2. Kiểm tra record mới nhất
        console.log('\n🕐 === RECORD CHẤM CÔNG MỚI NHẤT ===');
        const latestRecord = await TimeAttendance.findOne()
            .sort({ updatedAt: -1 })
            .populate('user', 'fullname email employeeCode');

        if (latestRecord) {
            console.log(`👤 Nhân viên: ${latestRecord.user?.fullname || 'Chưa có tên'} (${latestRecord.employeeCode})`);
            console.log(`📅 Ngày: ${new Date(latestRecord.date).toLocaleDateString('vi-VN')}`);
            console.log(`⏰ Check-in: ${latestRecord.checkInTime ? new Date(latestRecord.checkInTime).toLocaleString('vi-VN') : 'Chưa có'}`);
            console.log(`🏁 Check-out: ${latestRecord.checkOutTime ? new Date(latestRecord.checkOutTime).toLocaleString('vi-VN') : 'Chưa có'}`);
            console.log(`🔢 Số lần chấm công: ${latestRecord.totalCheckIns}`);
            console.log(`🔄 Cập nhật lần cuối: ${new Date(latestRecord.updatedAt).toLocaleString('vi-VN')}`);
        } else {
            console.log('❌ Không có record nào trong hệ thống');
        }

        // 3. Kiểm tra theo mã nhân viên cụ thể (nếu có)
        const employeeCodeToCheck = process.argv[2]; // Lấy từ command line argument
        if (employeeCodeToCheck) {
            console.log(`\n🔍 === KIỂM TRA CHI TIẾT CHO MÃ NV: ${employeeCodeToCheck} ===`);

            const employeeRecords = await TimeAttendance.find({
                employeeCode: employeeCodeToCheck,
                date: {
                    $gte: todayStart,
                    $lte: todayEnd
                }
            }).populate('user', 'fullname email employeeCode');

            if (employeeRecords.length === 0) {
                console.log(`❌ Không tìm thấy record chấm công cho mã NV: ${employeeCodeToCheck}`);
            } else {
                employeeRecords.forEach(record => {
                    console.log(`✅ Tìm thấy record cho ${employeeCodeToCheck}:`);
                    console.log(`   📅 Ngày: ${new Date(record.date).toLocaleDateString('vi-VN')}`);
                    console.log(`   ⏰ Check-in: ${record.checkInTime ? new Date(record.checkInTime).toLocaleString('vi-VN') : 'Chưa có'}`);
                    console.log(`   🏁 Check-out: ${record.checkOutTime ? new Date(record.checkOutTime).toLocaleString('vi-VN') : 'Chưa có'}`);
                    console.log(`   🔢 Số lần chấm công: ${record.totalCheckIns}`);

                    // Hiển thị raw data nếu có
                    if (record.rawData && record.rawData.length > 0) {
                        console.log(`   📊 Chi tiết các lần chấm công:`);
                        record.rawData.forEach((raw, index) => {
                            console.log(`      ${index + 1}. ${new Date(raw.timestamp).toLocaleString('vi-VN')} (Device: ${raw.deviceId || 'N/A'})`);
                        });
                    }
                });
            }
        }

        // 4. Thống kê tổng quan
        console.log('\n📈 === THỐNG KÊ TỔNG QUAN ===');
        const totalRecords = await TimeAttendance.countDocuments();
        const totalEmployees = await TimeAttendance.distinct('employeeCode');
        const thisWeekStart = new Date(today);
        thisWeekStart.setDate(today.getDate() - today.getDay());
        thisWeekStart.setHours(0, 0, 0, 0);

        const thisWeekRecords = await TimeAttendance.countDocuments({
            date: { $gte: thisWeekStart }
        });

        console.log(`📊 Tổng số record trong hệ thống: ${totalRecords}`);
        console.log(`👥 Tổng số nhân viên đã từng chấm công: ${totalEmployees.length}`);
        console.log(`📅 Số record tuần này: ${thisWeekRecords}`);

        console.log('\n✅ Hoàn thành kiểm tra log chấm công');

    } catch (error) {
        console.error('❌ Lỗi khi kiểm tra log chấm công:', error);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Đã ngắt kết nối MongoDB');
    }
}

// Chạy script
if (require.main === module) {
    console.log('🚀 Bắt đầu kiểm tra log chấm công...');
    console.log('💡 Sử dụng: node check_attendance_log.js [mã_nhân_viên]');
    checkAttendanceLog();
}

module.exports = { checkAttendanceLog }; 