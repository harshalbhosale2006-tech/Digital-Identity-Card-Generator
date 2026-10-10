package com.digitalid.backend.repository;

import com.digitalid.backend.entity.IdCard;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface IdCardRepository extends JpaRepository<IdCard, Long> {
    boolean existsByIdNumberIgnoreCase(String idNumber);
    boolean existsByIdNumberIgnoreCaseAndIdNot(String idNumber, Long id);
    Optional<IdCard> findByIdNumberIgnoreCase(String idNumber);
    Optional<IdCard> findByVerificationToken(String verificationToken);
    boolean existsByVerificationToken(String verificationToken);
    boolean existsByVerificationTokenAndCardTypeIgnoreCase(String verificationToken, String cardType);
    @Query("select c from IdCard c where " +
        "(:q is null or :q = '' or lower(c.fullName) like lower(concat('%', :q, '%')) or lower(c.idNumber) like lower(concat('%', :q, '%')) or lower(coalesce(c.email, '')) like lower(concat('%', :q, '%'))) and " +
        "(:status is null or :status = '' or lower(c.status) = lower(:status)) and " +
        "(:department is null or :department = '' or lower(coalesce(c.department, '')) = lower(:department)) and " +
        "(:course is null or :course = '' or lower(coalesce(c.course, '')) = lower(:course)) and " +
        "(:year is null or :year = '' or c.year = :year) and " +
        "(:semester is null or :semester = '' or c.semester = :semester)")
    Page<IdCard> searchCards(@Param("q") String q, @Param("status") String status,
        @Param("department") String department, @Param("course") String course,
        @Param("year") String year, @Param("semester") String semester, Pageable pageable);
    long countByStatusIgnoreCase(String status);
}
